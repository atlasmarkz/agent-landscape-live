from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "preview"
OUT.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.on("console", lambda msg: errors.append(f"{msg.type}: {msg.text}") if msg.type == "error" else None)
    page.goto("http://127.0.0.1:8000/", wait_until="networkidle")
    page.wait_for_timeout(900)

    print("stages:", page.evaluate("() => [...document.querySelectorAll('.stage-block')].map(s => s.id)"))
    print("first stage header:", page.locator("#stage-eval .stage-head").inner_text())

    page.locator("#stage-eval").scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.locator("#stage-eval").screenshot(path=str(OUT / "stage-eval.png"))

    page.locator("#stage-eval [data-stage-more]").click()
    page.wait_for_timeout(300)
    page.locator("#stage-eval").screenshot(path=str(OUT / "stage-eval-open.png"))

    page.locator("#method").scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.locator("#method").screenshot(path=str(OUT / "method.png"))

    page.locator("footer").scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / "footer.png"))

    # Toggle all in curated mode
    page.locator("#live").scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.locator("#toggleAll").click()
    page.wait_for_timeout(500)
    print("after expand all cards:", page.locator(".repo-card").count(), "label:", page.locator("#toggleAllText").inner_text())

    # Hot mode at top of live
    page.locator('[data-mode="hot"]').click()
    page.wait_for_timeout(400)
    page.locator("#live").scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / "live-hot-top.png"))
    print("hot stages:", page.locator(".stage-block").count(), "cards:", page.locator(".repo-card").count())

    # Rising mode
    page.locator('[data-mode="rising"]').click()
    page.wait_for_timeout(400)
    print("rising stages:", page.locator(".stage-block").count(), "cards:", page.locator(".repo-card").count())
    print("rising results:", page.locator("#resultsMeta").inner_text())

    # Mobile menu
    mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    mobile.goto("http://127.0.0.1:8000/", wait_until="networkidle")
    mobile.wait_for_timeout(700)
    mobile.locator("#menuBtn").click()
    mobile.wait_for_timeout(200)
    mobile.screenshot(path=str(OUT / "mobile-menu.png"))
    mobile.locator("#stage-eval").scroll_into_view_if_needed()
    mobile.wait_for_timeout(300)
    mobile.screenshot(path=str(OUT / "mobile-stage.png"))

    print("scrollHeight:", page.evaluate("() => document.body.scrollHeight"))
    print("errors:", errors)
    browser.close()
