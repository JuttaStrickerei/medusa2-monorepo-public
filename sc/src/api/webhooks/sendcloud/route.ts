import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
// Korrekter Default-Import für den Service:
import FulfillmentModuleService from "@medusajs/fulfillment";
// Workflow importieren (Pfad prüfen!)
import { markFulfillmentAsDeliveredWorkflow } from "@medusajs/medusa/core-flows";

// Definiere einen Typ für den erwarteten Sendcloud-Payload (optional, aber gut für Typsicherheit)
interface SendcloudParcel {
  id: number;
  tracking_number: string;
  status: {
    id: number;
    message: string;
  };
  order_number?: string;
}

interface SendcloudWebhookPayload {
  action: string;
  parcel: SendcloudParcel;
  timestamp?: string;
}

// Hilfsfunktion zum sicheren Zugriff auf verschachtelte Eigenschaften (optional)
const get = (obj: any, path: string, defaultValue: any = undefined) => {
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    result = result?.[key];
    if (result === undefined || result === null) {
      return defaultValue;
    }
  }
  return result;
};


export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  console.log(
    "[SendcloudWebhook] Received webhook:",
    JSON.stringify(req.body, null, 2)
  );

  try {
    // Auflösen des Haupt-Fulfillment-Modul-Services via Typinferenz
    const fulfillmentModuleService = req.scope.resolve(Modules.FULFILLMENT);
    console.log("Successfully resolved Fulfillment Module Service (type inferred).");

    // --- Hier beginnt deine Logik ---

    // 1. Extrahiere relevante Daten (mit Typisierung)
    const payload = req.body as SendcloudWebhookPayload;
    const action = get(payload, 'action');
    const parcel = get(payload, 'parcel');
    const trackingNumber = get(parcel, 'tracking_number');
    const statusMessage = get(parcel, 'status.message');

    if (!action || !parcel || !trackingNumber || !statusMessage) {
      console.error("Webhook payload is missing required properties (action, parcel, tracking_number, status.message).");
      return res.status(200).json({ success: false, message: "Invalid payload structure." });
    }

    console.log(`Action: ${action}, Tracking: ${trackingNumber}, Status: ${statusMessage}`);

    // 2. Finde das entsprechende Medusa Fulfillment
    let medusaFulfillmentId: string | undefined = undefined;
    let foundFulfillment: any | undefined = undefined; // Speicher das ganze Objekt

    try {
      // Korrekte Provider-ID verwenden
      const providerId = 'sendcloud_sendcloud';

      console.log(`Listing fulfillments with provider_id '${providerId}' to find tracking number: ${trackingNumber}`);

      // *** KORREKTUR HIER: Versuche 'labels' Relation zu laden ***
      const fulfillmentsFromProvider = await fulfillmentModuleService.listFulfillments(
         { provider_id: [providerId] },
         { relations: ["labels", "metadata"] } // Laden 'labels' und 'metadata'
      );

      console.log(`Found ${fulfillmentsFromProvider.length} fulfillments from provider '${providerId}'. Now attempting manual search using 'labels'.`); // Log angepasst

      // -------------------------------------------------------------------------
      // *** KORREKTUR HIER: Suche innerhalb des 'labels'-Arrays ***
      // -------------------------------------------------------------------------
      for (const fulfillment of fulfillmentsFromProvider) {
        const labels = get(fulfillment, 'labels'); // Hole das 'labels'-Array

        if (Array.isArray(labels)) { // Prüfe, ob 'labels' ein Array ist
          // Finde ein Label, dessen tracking_number übereinstimmt
          const matchingLabel = labels.find(
            (label: any) => get(label, 'tracking_number') === trackingNumber
          );

          if (matchingLabel) {
            // Treffer! Wir haben das richtige Fulfillment gefunden.
            console.log(`Found matching Medusa fulfillment ID: ${fulfillment.id} by searching 'labels' array.`); // Log angepasst
            medusaFulfillmentId = fulfillment.id;
            foundFulfillment = fulfillment;
            break; // Stoppe die Schleife
          }
        } else {
           // Logge, falls 'labels' nicht geladen wurde oder kein Array ist
           // console.log(`Fulfillment ${fulfillment.id} has no 'labels' array populated.`);
        }
      } // Ende der for-Schleife

      if (!medusaFulfillmentId) {
           console.warn(`No Medusa fulfillment found for tracking number: ${trackingNumber} after searching 'labels' array.`); // Log angepasst
      }

    } catch(listError) {
        // Falls 'labels' auch eine ValidationError wirft, landet der Fehler hier
        console.error("Error trying to list fulfillments (check if 'labels' relation is correct):", listError);
    }

    // 3. Führe Aktionen basierend auf dem Webhook aus (nur wenn Fulfillment gefunden wurde)
    //    Dieser Block sollte jetzt erreicht werden, wenn die Suche erfolgreich war.
    if (medusaFulfillmentId && foundFulfillment) {
        if (action === "parcel_status_changed") {
            console.log(`Processing status change for Medusa fulfillment ${medusaFulfillmentId} to ${statusMessage}`);

            if (statusMessage.toLowerCase() === "delivered") {
                 try {
                    const workflowInput = { id: medusaFulfillmentId };
                    console.log(`Triggering 'markFulfillmentAsDeliveredWorkflow' for fulfillment ${medusaFulfillmentId}...`);
                    await markFulfillmentAsDeliveredWorkflow(req.scope).run({ input: workflowInput });
                    console.log(`Workflow 'markFulfillmentAsDeliveredWorkflow' completed for fulfillment ${medusaFulfillmentId}`);
                 } catch (workflowError) {
                    console.error(`Error running markFulfillmentAsDeliveredWorkflow for ${medusaFulfillmentId}:`, workflowError);
                 }
            } else {
                console.log(`TODO: Implement logic for status '${statusMessage}' on fulfillment ${medusaFulfillmentId}`);
                try {
                    await fulfillmentModuleService.updateFulfillment(medusaFulfillmentId, {
                        metadata: {
                            ...(foundFulfillment.metadata || {}),
                            last_sendcloud_status: statusMessage,
                            last_sendcloud_status_timestamp: payload.timestamp || new Date().toISOString()
                        }
                    });
                    console.log(`Updated metadata for fulfillment ${medusaFulfillmentId}`);
                } catch (updateError) {
                     console.error(`Error updating metadata for fulfillment ${medusaFulfillmentId}:`, updateError);
                }
            }
        } else {
            console.log(`Unhandled action '${action}' for fulfillment ${medusaFulfillmentId}`);
        }
    } else {
         // Diese Meldung sollte nur noch erscheinen, wenn die Suche in 'labels' fehlschlägt
         console.log(`No action taken as no matching Medusa fulfillment was found for tracking: ${trackingNumber}`);
    }

    // --- Ende deiner Logik ---

    return res.status(200).json({
      success: true,
      message: "Webhook received and processing attempted (check logs for details).",
      payload: req.body,
    });

  } catch (error) {
    console.error("[SendcloudWebhook] Unhandled error in POST handler:", error);
    return res.status(200).json({
      success: false,
      message: `Unhandled error processing webhook: ${error.message}`,
      payload: req.body,
    });
  }
};

// Disable CORS and authentication for this endpoint
export const CORS = false;
export const AUTHENTICATE = false;