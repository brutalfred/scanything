import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";
import { isNativeAndroid } from "@/lib/platform";

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (options: {
    priceId: string;
    customerEmail?: string;
    customData?: Record<string, string>;
    successUrl?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onComplete?: (event: any) => void;
  }) => {
    if (isNativeAndroid()) {
      throw new Error("Purchases in the app go through Google Play billing");
    }
    setLoading(true);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(options.priceId);

      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: options.customData,
        settings: {
          displayMode: "overlay",
          successUrl: options.successUrl || `${window.location.origin}/?checkout=success`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
