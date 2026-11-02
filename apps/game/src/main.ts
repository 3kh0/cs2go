import "./home-popup.css";
import "./fonts.css";

const userAgent = navigator.userAgent;
const chrome =
  /(?:Chrome|HeadlessChrome|CriOS)\//.test(userAgent) &&
  !/(?:Edg|EdgA|EdgiOS|OPR|OPiOS|Opera|SamsungBrowser)\//.test(userAgent);
const mobile =
  (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile ===
    true ||
  /Android|iPhone|iPad|iPod|Mobile/.test(userAgent) ||
  // ipad reports a desktop Mac user agent because why the fuck not
  (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1);

if (chrome && !mobile) {
  void import("./app");
} else {
  const firefox = /(?:Firefox|FxiOS)\//.test(userAgent);
  const message = mobile
    ? "Mobile browsers are not supported. Please use a Chromium-based browser on a desktop computer to play CS2GO."
    : `${firefox ? "Firefox is" : "This browser is"} not supported. Please use a Chromium-based browser to play CS2GO.`;
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
