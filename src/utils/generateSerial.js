export const generateSerialNo = (lastNumber = 1000) => {
  return `BILL-${lastNumber + 1}`;
};