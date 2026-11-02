import "./home-popup.css";
import "./fonts.css";

const userAgent = navigator.userAgent;
const chrome =
  /(?:Chrome|HeadlessChrome|CriOS)\//.test(userAgent) &&
  !/(?:Edg|EdgA|EdgiOS|OPR|OPiOS|Opera|SamsungBrowser)\//.test(userAgent);

if (chrome) {
  void import("./app");
} else {
  const firefox = /(?:Firefox|FxiOS)\//.test(userAgent);
  document.body.style.cssText = 'margin:0;background:#000;font-family:"Stratum2",sans-serif';
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <section id="home-panel" role="dialog" aria-modal="true" aria-labelledby="home-panel-title">
      <div class="home-popup"><div id="home-panel-content">
        <h2 id="home-panel-title">Browser not supported</h2>
        <p>${firefox ? "Firefox is" : "This browser is"} not supported. Please use a Chromium-based browser to play CS2GO.</p>
      </div><div class="home-popup-actions"></div></div>
    </section>`;
  const panel = document.getElementById("home-panel")!;
  const close = () => panel.remove();
  document.getElementById("home-panel-close")!.addEventListener("click", close);
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  document.getElementById("home-panel-close")!.focus();
}
