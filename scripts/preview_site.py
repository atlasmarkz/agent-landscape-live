from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = ROOT / "preview"
OUT.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    errors = []
    page.on("console", lambda msg: errors.append(f"console {msg.type}: {msg.text}") if msg.type in ("error", "warning") else None)
    page.on("pageerror", lambda err: errors.append(f"pageerror: {err}"))
    page.goto("http://127.0.0.1:8000/", wait_until="networkidle")
    page.wait_for_timeout(1200)

    page.screenshot(path=str(OUT / "hero.png"))

    page.locator("#live").scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / "live.png"))

    page.locator("#architecture").scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / "architecture.png"))

    metrics = page.evaluate("""() => ({
      title: document.title,
      stages: document.querySelectorAll('.stage-block').length,
      cards: document.querySelectorAll('.repo-card').length,
      sync: document.querySelector('#syncText')?.textContent,
      results: document.querySelector('#resultsMeta')?.textContent,
      signalRows: document.querySelectorAll('.signal-row').length,
      tickerItems: document.querySelectorAll('.ticker-item').length,
      brokenImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      modes: [...document.querySelectorAll('.mode-tab')].map(t => [t.dataset.mode, t.classList.contains('is-active')]),
      firstCard: document.querySelector('.repo-card .repo-name')?.textContent.trim(),
      firstCardHref: document.querySelector('.repo-card')?.getAttribute('href'),
    })""")
    print(metrics)

    # Hot mode
    page.locator('[data-mode="hot"]').click()
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / "live-hot.png"))
    print("hot:", page.evaluate("() => ({results: document.querySelector('#resultsMeta')?.textContent, cards: document.querySelectorAll('.repo-card').length, first: document.querySelector('.repo-card .repo-name')?.textContent.trim()})"))

    # Search
    page.fill("#searchInput", "vllm")
    page.wait_for_timeout(400)
    print("search:", page.evaluate("() => ({results: document.querySelector('#resultsMeta')?.textContent, cards: document.querySelectorAll('.repo-card').length, emptyHidden: document.querySelector('#emptyState').hidden})"))
    page.fill("#searchInput", "")
    page.wait_for_timeout(300)

    # Mobile
    mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    mobile_errors = []
    mobile.on("pageerror", lambda err: mobile_errors.append(str(err)))
    mobile.goto("http://127.0.0.1:8000/", wait_until="networkidle")
    mobile.wait_for_timeout(800)
    mobile.screenshot(path=str(OUT / "mobile-hero.png"))
    mobile.locator("#live").scroll_into_view_if_needed()
    mobile.wait_for_timeout(400)
    mobile.screenshot(path=str(OUT / "mobile-live.png"))
    print("mobile overflow:", mobile.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth"), "errors:", mobile_errors)

    print("errors:", errors[:20])
    browser.close()
