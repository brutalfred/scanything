import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isPiBrowser, piCreatePayment, setIncompletePaymentHandler } from "@/lib/pi";
import {
  getPiCreditPacks,
  piApprovePayment,
  piCancelPayment,
  piCompletePayment,
  type PiPack,
} from "@/lib/pi-payments.functions";

/** Credit pack prices converted to Pi at the current daily rate. */
export function usePiPacks(enabled: boolean) {
  return useQuery({
    queryKey: ["pi-packs"],
    queryFn: () => getPiCreditPacks(),
    enabled,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

/**
 * User-to-App Pi purchases of credit packs.
 *
 * Approval and completion both happen server-side against the Pi Platform API;
 * an interrupted payment is finished through the same completion path.
 */
export function usePiPayments() {
  const queryClient = useQueryClient();
  const [available, setAvailable] = useState(false);
  const [busyPackId, setBusyPackId] = useState<string | null>(null);
  const finishing = useRef(new Set<string>());

  const complete = useCallback(
    async (paymentId: string, txid?: string) => {
      if (finishing.current.has(paymentId)) return;
      finishing.current.add(paymentId);
      try {
        const result = await piCompletePayment({ data: { paymentId, txid } });
        await queryClient.invalidateQueries({ queryKey: ["credits"] });
        if (result.status === "granted") {
          toast.success(`${result.credits} credits added`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not finish the Pi payment");
      } finally {
        finishing.current.delete(paymentId);
      }
    },
    [queryClient],
  );

  useEffect(() => {
    setAvailable(isPiBrowser());
    // Never ignore an in-flight payment: finish it through the backend.
    setIncompletePaymentHandler((payment) => {
      if (!payment?.identifier) return;
      void complete(payment.identifier, payment.transaction?.txid);
    });
  }, [complete]);

  const buy = useCallback(
    async (pack: PiPack) => {
      if (busyPackId) return;
      setBusyPackId(pack.packId);
      try {
        await piCreatePayment(
          {
            amount: pack.pi,
            memo: `Scanything ${pack.label} — ${pack.credits} credits`,
            metadata: { packId: pack.packId, credits: pack.credits },
          },
          {
            onReadyForServerApproval: (paymentId) => {
              void piApprovePayment({ data: { paymentId } }).catch((err: unknown) => {
                toast.error(
                  err instanceof Error ? err.message : "Pi payment could not be approved",
                );
              });
            },
            onReadyForServerCompletion: (paymentId, txid) => {
              void complete(paymentId, txid);
            },
            onCancel: (paymentId) => {
              setBusyPackId(null);
              void piCancelPayment({ data: { paymentId } }).catch(() => {});
              toast.info("Pi payment cancelled");
            },
            onError: (error) => {
              setBusyPackId(null);
              toast.error(error?.message ?? "Pi payment failed");
            },
          },
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Pi payment failed");
      } finally {
        setBusyPackId(null);
      }
    },
    [busyPackId, complete],
  );

  return { available, busyPackId, buy };
}
