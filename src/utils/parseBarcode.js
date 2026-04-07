export const parseBarcode = (barcode) => {
  if (!barcode || !barcode.includes("-")) return null;

  const [code, price] = barcode.split("-");
  if (!code || !price || isNaN(Number(price))) return null;

  return {
    serialId: code.trim(),
    price: Number(price),
  };
};