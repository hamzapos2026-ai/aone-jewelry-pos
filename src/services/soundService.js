import { Howl } from "howler";

const soundMap = {
  newBill: "/sounds/new-bill.mp3",
  billSaved: "/sounds/bill-saved.mp3",
  barcodeSuccess: "/sounds/barcode-success.mp3",
  error: "/sounds/error.mp3",
  offline: "/sounds/offline.mp3",
  syncComplete: "/sounds/sync-complete.mp3",
};

export const playSound = (type) => {
  const src = soundMap[type];
  if (!src) return;

  const sound = new Howl({
    src: [src],
    volume: 0.7,
  });

  sound.play();
};