import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import SendcloudFulfillmentProviderService from "../../../modules/sendcloud/service"
import { SENDCLOUD_IDENTIFIER } from "../../../modules/sendcloud"

// Define webhook payload type
type SendcloudWebhookPayload = {
  action: string
  parcel: {
    id: number
    tracking_number?: string
    status: {
      id: number
      message: string
    }
    [key: string]: any
  }
  [key: string]: any
}

/**
 * Webhook handler for Sendcloud status updates
 * 
 * Documentation: https://panel.sendcloud.sc/api/docs/v2/index.html#tag/webhooks
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    console.log("[SendcloudWebhook] Received webhook:", JSON.stringify(req.body, null, 2))
    
    // Cast the request body to our expected type
    const webhookData = req.body as SendcloudWebhookPayload
    
    // Validate the webhook data
    if (!webhookData.action) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Invalid webhook data: missing action"
      )
    }

    // Extract the relevant data
    const { action, parcel } = webhookData
    
    if (!parcel || !parcel.id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Invalid webhook data: missing parcel information"
      )
    }

    // Skip actions we're not interested in
    if (action !== "parcel_status_changed") {
      console.log(`[SendcloudWebhook] Ignoring webhook action: ${action}`)
      return res.status(200).json({ success: true, message: `Action ${action} ignored` })
    }

    // Extract data needed for updating fulfillment status
    const parcelId = parcel.id
    const trackingNumber = parcel.tracking_number || ""
    const status = parcel.status.message
    
    console.log(`[SendcloudWebhook] Processing status update for parcel ${parcelId}, tracking ${trackingNumber}, status: ${status}`)
    
    // Get the Sendcloud service directly
    try {
      // Resolve the Sendcloud service from the container
      const sendcloudService = req.scope.resolve<SendcloudFulfillmentProviderService>(SENDCLOUD_IDENTIFIER)
      
      // Update the fulfillment status
      await sendcloudService.updateFulfillmentStatus(parcelId, trackingNumber, status)
      
      console.log(`[SendcloudWebhook] Successfully processed webhook for parcel ${parcelId}`)
      
      return res.status(200).json({ 
        success: true, 
        message: `Successfully updated status for parcel ${parcelId} to ${status}` 
      })
    } catch (serviceError) {
      console.error(`[SendcloudWebhook] Error when resolving service: ${serviceError.message}`)
      
      // Return 200 status with error message to prevent Sendcloud from retrying
      return res.status(200).json({ 
        success: false, 
        message: `Error processing webhook: ${serviceError.message}` 
      })
    }
  } catch (error) {
    console.error("[SendcloudWebhook] Error processing webhook:", error)
    
    // Return 200 even on error to prevent Sendcloud from retrying
    // But include error message in response
    return res.status(200).json({ 
      success: false, 
      message: `Error processing webhook: ${error.message}` 
    })
  }
}

// Disable CORS and authentication for this endpoint
export const CORS = false
export const AUTHENTICATE = false