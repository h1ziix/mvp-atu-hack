// Browser sessions stay in memory. The native version uses the device keystore.
let session: string | null = null;
export const readSmartSession = async () => session;
export const writeSmartSession = async (value: string | null) => {
  session = value;
};
