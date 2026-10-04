#!/usr/bin/env python3
"""Browser test for the EmulatorJS pages (gb/, gba/, ws/, ngp/).

    bash run.sh &                      # serves the site on http://localhost:8770/
    python3 tests/e2e.py [url] [folder for screenshots]

Needs: pip install playwright pillow (and a Chromium for Playwright). It copies the test ROMs from
tests/probes/ into roms/<console>/ for the run and removes them afterwards, so the server must be
serving this folder. Extra ROMs you want booted as well: --also gb=path/to/game.gb (repeatable).

What it checks, in a phone-sized window with touch: the list of games, the free game that comes
with the Game Boy page and the Game Boy screen shader, booting, that nothing is fetched from another site, whole-number scaling at the screen's own pixels, the touch controls
reaching the game, cartridge saves and save states surviving a reload, the file picker (plain and
zipped), the sideways layout, WonderSwan rotation, and a desktop-sized window without touch.
"""
import io, os, shutil, sys, time, zipfile
from playwright.sync_api import sync_playwright
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
args = [a for a in sys.argv[1:] if not a.startswith("--")]
URL = (args[0] if args else "http://localhost:8770/").rstrip("/") + "/"
SHOTS = args[1] if len(args) > 1 else os.path.join(HERE, "shots")
ALSO = []
for i, a in enumerate(sys.argv):
    if a == "--also":
        k, v = sys.argv[i + 1].split("=", 1)
        ALSO.append((k, v))
os.makedirs(SHOTS, exist_ok=True)

NATIVE = {"gb": (160, 144), "gba": (240, 160), "ws": (224, 144), "ngp": (160, 152)}
PROBE = {"gb": "probe.gb", "gba": "probe.gba", "ws": "probe.ws", "ngp": "probe.ngc"}
EXTS = {"gb": ("gb", "gbc"), "gba": ("gba",), "ws": ("ws", "wsc"), "ngp": ("ngp", "ngc")}
TOP, PAD_BELOW, PAD_SIDE = 40, 250, 150
PHONE = dict(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True,
             user_agent="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36")
SIDEWAYS = dict(PHONE, viewport={"width": 844, "height": 390}, device_scale_factor=2.625)
DESKTOP = dict(viewport={"width": 1280, "height": 800}, device_scale_factor=1)

fails = []
def check(ok, what, detail=""):
    print(("  ok   " if ok else "  FAIL ") + what + (("  [" + str(detail) + "]") if detail != "" and not ok else ""))
    if not ok:
        fails.append(what)

STARTED = "window.pocketArcade.emulator && window.pocketArcade.emulator.started"


class Tab:
    def __init__(self, browser, kind):
        self.ctx = browser.new_context(**kind)
        self.page = self.ctx.new_page()
        self.cdp = self.ctx.new_cdp_session(self.page)
        self.requests, self.errors = [], []
        self.page.on("request", lambda r: self.requests.append(r.url))
        self.page.on("pageerror", lambda e: None if "Wake Lock" in str(e) else self.errors.append(str(e)))
        self.page.on("dialog", lambda d: d.accept())

    def close(self):
        self.ctx.close()

    def outside(self):
        return [u for u in self.requests if not u.startswith(URL) and not u.startswith(("blob:", "data:"))]

    def open(self, system):
        self.page.goto(URL + system + "/")
        self.page.wait_for_selector("#library h1")
        self.page.wait_for_timeout(600)

    def names(self, section):
        """The games listed in one section of the page: "free", "mine" (on this device) or "site"."""
        return self.page.eval_on_selector_all("#library #%s:not([hidden]) .pick .name" % section, "e => e.map(x => x.textContent)")

    def pick(self, name):
        row = self.page.locator(".pick", has=self.page.get_by_text(name, exact=True)).first
        (row.tap if self.ctx_touch() else row.click)()
        self.wait_started()

    def ctx_touch(self):
        return self.page.evaluate("navigator.maxTouchPoints > 0")

    def wait_started(self, settle=2500):
        self.page.wait_for_function(STARTED, timeout=90000)
        self.page.wait_for_timeout(settle)

    def ev(self, js):
        return self.page.evaluate(js)

    def save_bytes(self, n=6):
        return self.ev("Array.from(pocketArcade.emulator.gameManager.getSaveFile() || []).slice(0, %d)" % n)

    def shot(self, name):
        path = os.path.join(SHOTS, name + ".png")
        self.page.screenshot(path=path)
        return Image.open(path).convert("RGB")

    def picture(self, name):
        """Where the game's picture is on the screen, measured from a screenshot (in screen pixels)."""
        try:    # EmulatorJS's own menu bar slides over the bottom of the canvas for a moment after starting
            self.page.wait_for_function("(() => { const m = document.querySelector('#game .ejs_menu_bar'); return !m || m.classList.contains('ejs_menu_bar_hidden'); })()", timeout=8000)
            self.page.wait_for_timeout(400)
        except Exception:
            pass
        # The touch controls are hidden for the measurement: the Game Boy Advance's L and R sit over the
        # canvas, below the picture. Hiding them by a style sheet leaves the layout as it was.
        self.ev("document.head.appendChild(Object.assign(document.createElement('style'), {id: 'pa-test-hide', textContent: '#game .ejs_virtualGamepad_parent * { visibility: hidden !important; }'}))")
        self.page.wait_for_timeout(100)
        im = self.shot(name + "-measured")
        self.ev("document.getElementById('pa-test-hide').remove()")
        self.shot(name)
        g = self.ev("""() => { const c = pocketArcade.emulator.canvas, r = c.getBoundingClientRect();
            return {canvas: [c.width, c.height], css: [r.x, r.y, r.width, r.height], dpr: devicePixelRatio}; }""")
        dpr = g["dpr"]
        x0, y0 = round(g["css"][0] * dpr), round(g["css"][1] * dpr)
        crop = im.crop((x0, y0, x0 + round(g["css"][2] * dpr), y0 + round(g["css"][3] * dpr)))
        box = crop.point(lambda v: 255 if v else 0).getbbox()
        if not box:
            g.update(w=0, h=0, x=0, y=0, rgb=None)
            return g
        g.update(x=box[0], y=box[1], w=box[2] - box[0], h=box[3] - box[1],
                 rgb=list(crop.getpixel(((box[0] + box[2]) // 2, (box[1] + box[3]) // 2))),
                 colours=len(crop.crop(box).getcolors(maxcolors=1 << 24)))
        return g

    def _point(self, selector, dx=0.0, dy=0.0):
        box = self.page.locator(selector).first.bounding_box()
        return box["x"] + box["width"] * (0.5 + dx), box["y"] + box["height"] * (0.5 + dy)

    def hold(self, selector, dx=0.0, dy=0.0):
        x, y = self._point(selector, dx, dy)
        self.cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
        self.page.wait_for_timeout(350)

    def release(self):
        self.cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        self.page.wait_for_timeout(350)

    def held(self, selector, dx=0.0, dy=0.0, n=6):
        self.hold(selector, dx, dy)
        out = self.save_bytes(n)
        self.release()
        return out


def whole_number_scale(tab, system, name, tall=False, sideways=False, pad=True):
    p = tab.picture(name)
    nw, nh = NATIVE[system][::-1] if tall else NATIVE[system]
    k = p["w"] / nw
    check(p["w"] % nw == 0 and p["h"] == nh * k and k >= 1, "%s: picture is a whole-number multiple of %dx%d (x%s)" % (name, nw, nh, k), p)
    dpr = p["dpr"]
    check(abs(p["canvas"][0] / dpr - p["css"][2]) < 1 and abs(p["canvas"][1] / dpr - p["css"][3]) < 1, "%s: one canvas pixel is one screen pixel" % name, p)
    view = tab.page.viewport_size
    room_w = view["width"] - (2 * PAD_SIDE if (sideways and pad) else 0)
    room_h = view["height"] - TOP - (PAD_BELOW if (pad and not sideways) else 0)
    best = min(int(room_w * dpr) // nw, int(room_h * dpr) // nh)
    check(k == best, "%s: uses the largest scale that fits beside the controls (x%d)" % (name, best), (k, best))
    left, top = p["css"][0] + p["x"] / dpr, p["css"][1] + p["y"] / dpr
    right, bottom = left + p["w"] / dpr, top + p["h"] / dpr
    if pad:
        for sel in [".ejs_virtualGamepad_left", ".ejs_virtualGamepad_right", ".ejs_virtualGamepad_bottom .ejs_virtualGamepad_button", "#pa-back"]:
            for b in tab.page.locator("#game " + sel).all():
                if not b.is_visible():
                    continue
                r = b.bounding_box()
                apart = r["x"] >= right - 0.5 or r["x"] + r["width"] <= left + 0.5 or r["y"] >= bottom - 0.5 or r["y"] + r["height"] <= top + 0.5
                check(apart, "%s: %s is clear of the picture" % (name, sel), (r, left, top, right, bottom))
    return p


def run(browser):
    # ---------- each console, phone held upright ----------
    for system in ("gb", "gba", "ws", "ngp"):
        print("\n== %s, phone upright ==" % system)
        t = Tab(browser, PHONE)
        t.open(system)
        t.shot(system + "-1-list")
        site = t.names("site")
        check(PROBE[system].rsplit(".", 1)[0] in site, "the list shows what is in roms/%s/" % system, site)
        check(t.names("free") == (["Tricky Wicks"] if system == "gb" else []), "free games: Tricky Wicks on the Game Boy page, none elsewhere", t.names("free"))
        t.pick("probe")
        check(t.ev("location.search").startswith("?play=site"), "address remembers the game")
        check(t.outside() == [], "nothing was fetched from another site", t.outside())
        check(t.errors == [], "no script errors", t.errors)
        check(t.ev("getComputedStyle(pocketArcade.emulator.virtualGamepad).display") != "none", "touch controls are showing")
        check(t.ev("pocketArcade.emulator.getSettingValue('save-state-location')") == "browser", "save states are set to stay in the browser")
        p = whole_number_scale(t, system, system + "-2-play")
        idle = p["rgb"]

        if system == "gb":
            check(t.held("#game .b_a")[1] == 0x01, "touch A reaches the game")
            check(t.held("#game .b_b")[1] == 0x02, "touch B reaches the game")
            check(t.held("#game .b_select")[1] == 0x04, "touch Select reaches the game")
            check(t.held("#game .b_start")[1] == 0x08, "touch Start reaches the game")
            check(t.held("#game .b_dpad .ejs_dpad_main", dx=0.35)[1] == 0x10, "touch D-pad right reaches the game")
            check(t.held("#game .b_dpad .ejs_dpad_main", dy=-0.35)[1] == 0x40, "touch D-pad up reaches the game")
            check(t.save_bytes()[1] == 0, "and letting go releases it")
        elif system == "gba":
            check(t.held("#game .b_a")[1] == 0x01, "touch A reaches the game")
            check(t.held("#game .b_b")[1] == 0x02, "touch B reaches the game")
            check(t.held("#game .b_select")[1] == 0x04, "touch Select reaches the game")
            check(t.held("#game .b_start")[1] == 0x08, "touch Start reaches the game")
            check(t.held("#game .b_dpad .ejs_dpad_main", dx=0.35)[1] == 0x10, "touch D-pad right reaches the game")
            check(t.held("#game .b_dpad .ejs_dpad_main", dy=-0.35)[1] == 0x40, "touch D-pad up reaches the game")
            check(t.held("#game .b_r")[2] == 0x01, "touch R reaches the game")
            check(t.held("#game .b_l")[2] == 0x02, "touch L reaches the game")
            check(t.save_bytes()[1:3] == [0, 0], "and letting go releases it")
        elif system == "ws":
            check(t.held("#game .b_a")[2] == 0x04, "touch A reaches the game")
            check(t.held("#game .b_b")[2] == 0x08, "touch B reaches the game")
            check(t.held("#game .b_start")[2] == 0x02, "touch Start reaches the game")
            check(t.held("#game .b_x_dpad .ejs_dpad_main", dy=-0.35)[1] == 0x10, "left pad up is X1")
            check(t.held("#game .b_x_dpad .ejs_dpad_main", dx=0.35)[1] == 0x20, "left pad right is X2")
            check(t.held("#game .b_y_dpad .ejs_dpad_main", dy=-0.35)[1] == 0x01, "right pad up is Y1")
            check(t.held("#game .b_y_dpad .ejs_dpad_main", dx=-0.35)[1] == 0x08, "right pad left is Y4")
        else:
            def colour(sel, **kw):
                t.hold(sel, **kw)
                c = t.picture(system + "-touch")["rgb"]
                t.release()
                return c
            check(idle == [0, 0, 140], "probe shows its idle colour", idle)
            a, right, opt = colour("#game .b_a"), colour("#game .b_dpad .ejs_dpad_main", dx=0.35), colour("#game .b_option")
            check(a != idle and right != idle and opt != idle and len({tuple(a), tuple(right), tuple(opt)}) == 3,
                  "touch A, D-pad right and Option each reach the game", (idle, a, right, opt))

        # save state, then make sure a reload keeps both the state and (gb, gba, ws) the cartridge save
        before = t.save_bytes()
        t.ev("pocketArcade.emulator.elements.bottomBar.saveState[0].click()")
        t.page.wait_for_timeout(1500)
        key = PROBE[system] + ".state"
        size = t.ev("pocketArcade.emulator.storage.states.get(%r).then(s => s ? s.length : 0)" % key)
        check(size > 0, "Save State puts the state in the browser (%d bytes)" % size)
        path = t.ev("pocketArcade.emulator.gameManager.getSaveFilePath()")
        t.page.reload()
        t.page.wait_for_selector("#game .ejs_start_button")
        t.shot(system + "-3-after-reload")
        check(True, "a reload comes back to the same game, waiting for a tap")
        t.page.locator("#game .ejs_start_button").tap()
        t.wait_started()
        if system in ("gb", "gba", "ws"):
            now = t.save_bytes()
            check(now[0] == (before[0] + 1) % 256, "cartridge save survived the reload (%s, boots %d -> %d)" % (path, before[0], now[0]), (before, now))
        size2 = t.ev("pocketArcade.emulator.storage.states.get(%r).then(s => s ? s.length : 0)" % key)
        check(size2 == size, "the save state survived the reload")
        t.ev("pocketArcade.emulator.elements.bottomBar.loadState[0].click()")
        t.page.wait_for_timeout(1500)
        if system in ("gb", "gba", "ws"):
            back = t.save_bytes()
            check(back[0] == before[0], "Load State puts the machine back as it was saved (boots %d)" % back[0], (before, back))
        check(t.ev(STARTED) and t.errors == [], "still running after loading the state", t.errors)

        # back to the list
        t.page.locator("#pa-back").tap()
        t.page.wait_for_selector("#library h1")
        t.page.wait_for_timeout(500)
        check(t.ev("location.search") == "" and not t.ev("document.body.classList.contains('playing')"), "Games goes back to the list")

        # the file picker
        rom = os.path.join(HERE, "probes", PROBE[system])
        ext = PROBE[system].rsplit(".", 1)[1]
        t.page.set_input_files("#library input[type=file]", {"name": "notes.txt", "mimeType": "text/plain", "buffer": b"hello"})
        t.page.wait_for_timeout(400)
        check("not a" in t.ev("document.querySelector('.note').textContent"), "a file of the wrong kind is refused with a message")
        t.page.set_input_files("#library input[type=file]", {"name": "Picked Game." + ext, "mimeType": "application/octet-stream", "buffer": open(rom, "rb").read()})
        t.wait_started()
        check(t.ev("location.search").startswith("?play=mine"), "a picked file starts straight away")
        t.picture(system + "-4-picked")
        t.page.locator("#pa-back").tap()
        t.page.wait_for_selector("#library h1")
        t.page.wait_for_timeout(500)
        check(t.names("mine") == ["Picked Game"], "and is kept under 'On this device'", t.names("mine"))
        z = io.BytesIO()
        with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as f:
            f.write(rom, "Zipped Game." + ext)
        t.page.set_input_files("#library input[type=file]", {"name": "Zipped Game.zip", "mimeType": "application/zip", "buffer": z.getvalue()})
        t.wait_started()
        check(t.picture(system + "-5-zipped")["w"] > 0, "a zipped game boots too")
        t.page.locator("#pa-back").tap()
        t.page.wait_for_selector("#library h1")
        t.page.wait_for_timeout(500)
        t.page.reload()
        t.page.wait_for_selector("#library h1")
        t.page.wait_for_timeout(600)
        check(t.names("mine") == ["Picked Game", "Zipped Game"], "picked games are still listed after a reload", t.names("mine"))
        t.page.locator(".drop").first.tap()
        t.page.wait_for_timeout(500)
        check(t.names("mine") == ["Zipped Game"], "a game can be removed from the device", t.names("mine"))
        check(t.outside() == [], "still nothing fetched from another site", t.outside())
        check(t.errors == [], "no script errors", t.errors)
        t.close()

    # ---------- phone held sideways ----------
    for system in ("gb", "gba", "ws", "ngp"):
        print("\n== %s, phone sideways ==" % system)
        t = Tab(browser, SIDEWAYS)
        t.open(system)
        t.pick("probe")
        whole_number_scale(t, system, system + "-6-sideways", sideways=True)
        if system in ("gb", "gba"):
            check(t.held("#game .b_start")[1] == 0x08 and t.held("#game .b_select")[1] == 0x04, "Start and Select still work in their sideways place")
        # turn the phone upright mid-game
        t.page.set_viewport_size({"width": 390, "height": 844})
        t.page.wait_for_timeout(1500)
        whole_number_scale(t, system, system + "-7-turned-upright")
        t.close()

    # ---------- WonderSwan rotation ----------
    print("\n== ws, rotation ==")
    t = Tab(browser, PHONE)
    t.open("ws")
    t.pick("probe")
    check(not t.ev("pocketArcade.emulator.elements.parent.classList.contains('pa-tall')"), "an ordinary game starts flat")
    t.page.locator("#pa-turn").tap()
    t.page.wait_for_timeout(1500)
    whole_number_scale(t, "ws", "ws-8-upright", tall=True)
    check(t.held("#game .b_x_dpad .ejs_dpad_main", dy=-0.35)[1] == 0x02, "upright: left pad up is Y2 (the button that now points up)")
    check(t.held("#game .b_x_dpad .ejs_dpad_main", dx=0.35)[1] == 0x04, "upright: left pad right is Y3")
    check(t.held("#game .b_t_dpad .ejs_dpad_main", dy=-0.35)[1] == 0x20, "upright: right pad up is X2")
    check(t.held("#game .b_t_dpad .ejs_dpad_main", dx=0.35)[1] == 0x40, "upright: right pad right is X3")
    check(t.held("#game .b_t_a")[2] == 0x04 and t.held("#game .b_t_b")[2] == 0x08, "upright: A and B still reach the game")
    t.page.reload()
    t.page.wait_for_selector("#game .ejs_start_button")
    t.page.locator("#game .ejs_start_button").tap()
    t.wait_started()
    whole_number_scale(t, "ws", "ws-9-upright-remembered", tall=True)
    check(t.ev("pocketArcade.emulator.elements.parent.classList.contains('pa-tall')"), "the rotation is remembered for that game")
    t.page.locator("#pa-turn").tap()
    t.page.wait_for_timeout(1500)
    whole_number_scale(t, "ws", "ws-10-flat-again")
    t.page.locator("#pa-back").tap()
    t.page.wait_for_selector("#library h1")
    t.page.wait_for_timeout(500)
    t.pick("probe-tall")
    whole_number_scale(t, "ws", "ws-11-upright-game", tall=True)
    check(True, "a game whose header says 'held upright' starts upright")
    t.close()
    t = Tab(browser, SIDEWAYS)
    t.open("ws")
    t.pick("probe-tall")
    whole_number_scale(t, "ws", "ws-12-upright-game-sideways-phone", tall=True, sideways=True)
    t.close()

    # ---------- desktop, no touch ----------
    for system in ("gb", "gba", "ws", "ngp"):
        print("\n== %s, desktop without touch ==" % system)
        t = Tab(browser, DESKTOP)
        t.open(system)
        t.pick("probe")
        check(t.ev("getComputedStyle(pocketArcade.emulator.virtualGamepad).display") == "none", "no touch controls on a desktop")
        p = whole_number_scale(t, system, system + "-13-desktop", pad=False)
        if system in ("gb", "gba"):
            t.page.keyboard.down("ArrowRight")
            t.page.wait_for_timeout(300)
            b = t.save_bytes()
            t.page.keyboard.up("ArrowRight")
            check(b[1] == 0x10, "keyboard right arrow reaches the game", b)
        check(t.outside() == [] and t.errors == [], "nothing fetched from another site, no errors", (t.outside(), t.errors))
        t.close()

    # ---------- real programs: Matt Currie's display tests ----------
    print("\n== gb, real programs ==")
    t = Tab(browser, PHONE)
    t.open("gb")
    for rom, at_least in (("dmg-acid2", 4), ("cgb-acid2", 6)):
        t.pick(rom)
        p = whole_number_scale(t, "gb", "gb-14-" + rom)
        check(p["colours"] >= at_least and t.errors == [], "%s boots and draws its test picture (%d colours)" % (rom, p["colours"]), t.errors)
        offered = "Game Boy screen" in t.ev("Object.keys(pocketArcade.emulator.config.shaders)")
        check(offered == (rom == "dmg-acid2"), "the Game Boy screen shader is %s for %s" % ("offered" if rom == "dmg-acid2" else "not offered", rom))
        t.page.locator("#pa-back").tap()
        t.page.wait_for_selector("#library h1")
        t.page.wait_for_timeout(500)
    t.close()

    # ---------- the free game that comes with the Game Boy page ----------
    print("\n== gb, the free game ==")
    t = Tab(browser, PHONE)
    t.open("gb")
    rom = open(os.path.join(SITE, "free", "gb", "tricky-wicks.gb"), "rb").read()
    link = t.ev("(() => { const a = document.querySelector('#free .get'); return [a.href, a.getAttribute('download')]; })()")
    got = t.ev("fetch(%r).then(r => r.arrayBuffer()).then(b => b.byteLength)" % link[0])
    check(link[1] == "tricky-wicks.gb" and got == len(rom), "the download link hands over the ROM itself (%d bytes)" % got, (link, got))
    t.pick("Tricky Wicks")
    check(t.ev("new URLSearchParams(location.search).get('play')") == "free:tricky-wicks.gb", "address remembers the game")
    check(t.ev("document.title").startswith("Tricky Wicks"), "the tab is named after the game", t.ev("document.title"))
    p = whole_number_scale(t, "gb", "gb-15-free-title")
    check(p["colours"] >= 3 and t.errors == [], "Tricky Wicks boots to its title screen (%d colours)" % p["colours"], t.errors)
    # the Game Boy screen shader (play/shaders/): offered for this game, and it gives the picture the panel's colours
    check("Game Boy screen" in t.ev("Object.keys(pocketArcade.emulator.config.shaders)"), "the Game Boy screen shader is offered for an original Game Boy game")
    t.ev("pocketArcade.emulator.changeSettingOption('shader', 'Game Boy screen')")
    t.page.wait_for_timeout(2500)
    q = whole_number_scale(t, "gb", "gb-15-free-shader")
    r, g, b = q["rgb"]
    check(q["colours"] > 50 and b < r and b < g and t.errors == [], "with it on the picture is the panel's green-yellow, dots and all (%d colours, centre %s)" % (q["colours"], q["rgb"]), t.errors)
    check(t.ev("pocketArcade.emulator.getSettingValue('shader')") == "Game Boy screen", "and the choice is kept in the game's settings")
    title_screen = t.shot("gb-15-free-title").tobytes()
    t.hold("#game .b_start")                       # 1 PLAYER is the first choice on its menu
    t.release()
    t.page.wait_for_timeout(1500)
    for _ in range(3):                             # drop a few pieces
        t.hold("#game .b_dpad .ejs_dpad_main", dy=-0.35)
        t.release()
    check(t.shot("gb-16-free-playing").tobytes() != title_screen and t.errors == [], "Start begins a game and pieces drop", t.errors)
    t.page.locator("#pa-back").tap()
    t.page.wait_for_selector("#library h1")
    t.page.wait_for_timeout(500)
    check(t.names("free") == ["Tricky Wicks"] and t.names("mine") == [], "it is not copied into 'On this device'", (t.names("free"), t.names("mine")))
    check(t.outside() == [] and t.errors == [], "nothing fetched from another site, no errors", (t.outside(), t.errors))
    t.close()

    # ---------- any other ROMs given on the command line ----------
    for system, path in ALSO:
        name = os.path.basename(path)
        print("\n== %s: %s ==" % (system, name))
        t = Tab(browser, PHONE)
        t.open(system)
        t.page.set_input_files("#library input[type=file]", path)
        t.wait_started(6000)
        p = t.picture("also-" + name)
        check(p["w"] > 0 and t.errors == [], "%s boots (picture %dx%d, %d colours)" % (name, p["w"], p["h"], p.get("colours", 0)), t.errors)
        t.close()


def main():
    copied = []
    for system in NATIVE:
        d = os.path.join(SITE, "roms", system)
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(os.path.join(HERE, "probes")):
            if f.rsplit(".", 1)[-1] in EXTS[system] and not os.path.exists(os.path.join(d, f)):
                shutil.copy(os.path.join(HERE, "probes", f), os.path.join(d, f))
                copied.append(os.path.join(d, f))
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
            run(browser)
            browser.close()
    finally:
        for f in copied:
            os.remove(f)
    print("\n" + ("ALL CHECKS PASSED" if not fails else "%d FAILED:\n  " % len(fails) + "\n  ".join(fails)))
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
