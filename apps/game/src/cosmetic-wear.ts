export const wearCondition = (wear: number) =>
  wear < 0.07
    ? "Factory New"
    : wear < 0.15
      ? "Minimal Wear"
      : wear < 0.38
        ? "Field-Tested"
        : wear < 0.45
          ? "Well-Worn"
          : "Battle-Scarred";
