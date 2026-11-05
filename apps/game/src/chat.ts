import { MAX_CHAT_LENGTH, neutralInput, type ChatChannel, type ChatMessage } from "@cs2go/protocol";
import type { Game } from "./game";
import { playerName } from "./player-profile";
import "./chat.css";

export class MatchChat {
  open = false;
  private channel: ChatChannel = "team";
  private root = document.createElement("section");
  private log = document.createElement("div");
  private form = document.createElement("form");
  private label = document.createElement("label");
  private input = document.createElement("input");
  private expiry?: ReturnType<typeof setTimeout>;
  private game: Game;

  constructor(game: Game) {
    this.game = game;
    this.root.id = "match-chat";
    this.root.setAttribute("aria-label", "Match chat");
    this.log.id = "chat-log";
    this.log.setAttribute("role", "log");
    this.log.setAttribute("aria-live", "polite");
    this.form.hidden = true;
    this.label.htmlFor = this.input.id = "chat-input";
    this.input.type = "text";
    this.input.maxLength = MAX_CHAT_LENGTH;
    this.input.autocomplete = "off";
    this.input.placeholder = "Enter to send · Escape to cancel";
    this.form.append(this.label, this.input);
    this.root.append(this.log, this.form);
    document.getElementById("hud")!.append(this.root);
    this.input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.isComposing) return;
      if (event.code === "Escape") {
        event.preventDefault();
        this.close();
      } else if (event.code === "Tab") event.preventDefault();
    });
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = this.input.value.trim();
      if (!text) {
        this.close();
        return;
      }
      if (this.game.network) {
        if (!this.game.network.connection.sendChat(this.channel, text)) {
          this.game.notices.showAlert("Chat unavailable while disconnected.");
          return;
        }
      } else {
        this.receive({
          type: "chat",
          channel: this.channel,
          sender: "local",
          name: playerName(),
          team: this.game.team,
          text,
        });
      }
      this.close();
    });
  }

  show(channel: ChatChannel) {
    this.channel = channel;
    this.open = true;
    this.form.hidden = false;
    this.root.classList.add("chat-open", "chat-visible");
    this.label.textContent = channel === "team" ? "TEAM" : "ALL";
    this.input.setAttribute(
      "aria-label",
      channel === "team" ? "Team chat message" : "All chat message",
    );
    this.game.keys.clear();
    this.game.jumpQueued = this.game.firing = false;
    this.game.revolverCharge = 0;
    this.game.utility.cancelThrow();
    if (this.game.network) {
      this.game.network.request = neutralInput();
      this.game.network.connection.stopInput();
    }
    this.input.focus();
  }

  close() {
    this.open = false;
    this.form.hidden = true;
    this.input.value = "";
    this.input.blur();
    this.root.classList.remove("chat-open");
    this.game.keys.clear();
  }

  receive(message: ChatMessage) {
    const row = document.createElement("p");
    const name = document.createElement("strong");
    name.className = message.team;
    name.textContent = `${message.channel === "team" ? "(TEAM) " : "(ALL) "}${message.name}: `;
    row.append(name, document.createTextNode(message.text));
    this.log.append(row);
    while (this.log.childElementCount > 50) this.log.firstElementChild!.remove();
    this.log.scrollTop = this.log.scrollHeight;
    this.root.classList.add("chat-visible");
    clearTimeout(this.expiry);
    this.expiry = setTimeout(() => this.root.classList.remove("chat-visible"), 12000);
  }

  reset() {
    this.close();
    clearTimeout(this.expiry);
    this.log.replaceChildren();
    this.root.classList.remove("chat-visible");
  }
}
