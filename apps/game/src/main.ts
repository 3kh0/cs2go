import "./home-popup.css";
import "./fonts.css";

const userAgent = navigator.userAgent;
const firefox = /(?:Firefox|FxiOS)\//i.test(userAgent);
const mobile =
  (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile ===
    true ||
  /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ||
  // iPadOS can report a desktop Mac user agent.
  (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1);

if (!firefox && !mobile) {
  void import("./app");
} else {
  const message = mobile
    ? "Mobile browsers are not supported. Please use a desktop computer to play CS2GO."
    : "Firefox is not supported. Please use another desktop browser, such as Chrome or Edge, to play CS2GO.";
  document.body.style.cssText = 'margin:0;background:#000;font-family:"Stratum2",sans-serif';
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <section id="home-panel" role="dialog" aria-modal="true" aria-labelledby="home-panel-title">
      <div class="home-popup"><div id="home-panel-content">
        <h2 id="home-panel-title">Browser not supported</h2>
        <p>${message}</p>
      </div><div class="home-popup-actions">
        <a id="home-panel-github" href="https://github.com/3kh0/cs2go">VIEW ON GITHUB</a>
      </div></div>
    </section>`;
  document.getElementById("home-panel-github")!.focus();
}
