import type { Input, PlayerState } from "@cs2go/protocol";
import type { Match } from "./match";
import { addMoney } from "./economy";
import { weaponSlot, weapons } from "./physics";
import { cancelWeaponActions } from "./weapon-actions";
export type EquipmentKind = "kevlar" | "helmet" | "kit";
type EquipmentState = { armor: number; helmet: boolean; kit: boolean };
export function equipmentState(player: PlayerState): EquipmentState {
  return { armor: player.armor, helmet: player.helmet, kit: player.kit };
}
export function createReceipts() {
  return {
    weapons: new Map<number, { price: number; ammo: number; reserve: number }>(),
    equipment: [] as {
      kind: EquipmentKind;
      price: number;
      before: EquipmentState;
      after: EquipmentState;
    }[],
  };
}
export type Receipts = ReturnType<typeof createReceipts>;
export function refundableEquipment(match: Match, player: PlayerState, kind: EquipmentKind) {
  const receipts = match.receipts.get(player.id)!.equipment;
  const receipt = receipts.findLast((r) => r.kind === kind);
  if (!receipt) return false;
  return kind === "kit"
    ? player.kit && match.state.bomb.defuser !== player.id
    : receipts.findLast((r) => r.kind !== "kit") === receipt &&
        player.armor === receipt.after.armor &&
        player.helmet === receipt.after.helmet;
}
export function refund(match: Match, player: PlayerState, input: Input) {
  const receipts = match.receipts.get(player.id)!;
  const record = receipts.weapons.get(input.refund);
  if (record && player.magazines[input.refund]) {
    receipts.weapons.delete(input.refund);
    delete player.magazines[input.refund];
    delete player.appearances[input.refund];
    if (weaponSlot(input.refund) === 1) player.primary = null;
    player.money = addMoney(player.money, record.price, match.state.mode);
    if (player.weapon === input.refund) {
      player.weapon =
        player.primary ?? (player.magazines[player.secondary] ? player.secondary : player.knife);
      Object.assign(player, player.magazines[player.weapon]);
      cancelWeaponActions(player, match.actions.get(player.id)!);
      player.cooldown = weapons[player.weapon].deploy;
    }
  }
  const kind = input.refundEquipment;
  if (kind && refundableEquipment(match, player, kind)) {
    const receipt = receipts.equipment.findLast((r) => r.kind === kind)!;
    if (kind === "kit") player.kit = receipt.before.kit;
    else {
      player.armor = receipt.before.armor;
      player.helmet = receipt.before.helmet;
    }
    player.money = addMoney(player.money, receipt.price, match.state.mode);
    receipts.equipment.splice(receipts.equipment.indexOf(receipt), 1);
  }
}
export function publishReceipts(match: Match, player: PlayerState) {
  const receipts = match.receipts.get(player.id)!;
  player.refundableWeapons = [...receipts.weapons.keys()];
  player.refundableEquipment = (["kevlar", "helmet", "kit"] as const).filter((kind) =>
    refundableEquipment(match, player, kind),
  );
  player.grenadeReceipts = { ...match.utility.get(player.id)!.receipts };
}
