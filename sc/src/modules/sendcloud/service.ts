import {
  AbstractFulfillmentProviderService,
  MedusaError,
  Modules
} from "@medusajs/framework/utils"
import {
  FulfillmentItemDTO,
  FulfillmentOrderDTO,
  CreateFulfillmentResult,
  FulfillmentOption,
  CalculateShippingOptionPriceDTO,
  CalculatedShippingOptionPrice
} from "@medusajs/framework/types"
import { SendcloudClient } from "./client"

export type SendcloudOptions = {
  public_key: string
  secret_key: string
}

interface MappedOrderItem {
  id: string
  quantity: number
  weight: number
  [key: string]: any
}

class SendcloudFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = "sendcloud"
  protected client_: SendcloudClient
  protected options_: SendcloudOptions
  protected container_: any

  constructor(container, options: SendcloudOptions) {
    super()
    this.options_ = options
    this.client_ = new SendcloudClient(options)
    this.container_ = container  // Store the container
    
    if (process.env.NODE_ENV === "development") {
      this.client_.testConnection().then((success) => {
        if (!success) {
          console.error("[SendcloudProvider] Failed to connect to Sendcloud")
        } else {
          console.log("[SendcloudProvider] Successfully connected to Sendcloud")
        }
      })
    }
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    try {
      console.log("[SendcloudProvider] Fetching shipping methods...")
  
      const response = await this.client_.getShippingMethods({
        from_country: "NL", // TODO: Make configurable
        to_country: "DE"    // TODO: Make configurable
      })
  
      console.log(`[SendcloudProvider] Retrieved ${response.shipping_methods.length} shipping methods`)
  
      const shippingOptions = response.shipping_methods.map(method => ({
        id: `sendcloud_${method.id}`,
        name: method.name,
        provider_id: "sendcloud",
        data: {
          carrier: method.carrier,
          min_weight: method.min_weight,
          max_weight: method.max_weight,
          sendcloud_id: method.id,
          countries: method.countries
        }
      }))
  
      console.log(`[SendcloudProvider] Created ${shippingOptions.length} fulfillment options`)
      return shippingOptions
    } catch (error) {
      console.error("[SendcloudProvider] Error fetching shipping methods:", error)
      return []
    }
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    try {
      console.log("[SendcloudProvider] Validating shipping option:", data)
      const shippingMethods = await this.getFulfillmentOptions()
      const isValid = shippingMethods.some(method => method.id === data.id)
      console.log(`[SendcloudProvider] Shipping option validation result: ${isValid}`)
      return isValid
    } catch (error) {
      console.error("[SendcloudProvider] Error validating option:", error)
      return false
    }
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    console.log("[SendcloudProvider] Validating fulfillment data:", {
      optionData,
      data,
      context: { ...context, items: 'Omitted for logging' }
    })

    return {
      ...optionData,
      ...data
    }
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    try {
      console.log("[SendcloudProvider] Calculating price for option:", {
        optionData,
        context: { ...context, items: 'Omitted for logging' }
      })

      const sendcloudMethodId = (optionData as any).sendcloud_id
      
      if (!sendcloudMethodId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Sendcloud shipping method ID is required"
        )
      }

      const response = await this.client_.getShippingMethods()
      const method = response.shipping_methods.find(m => m.id === sendcloudMethodId)

      if (!method) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Shipping method with ID ${sendcloudMethodId} not found`
        )
      }

      if (!method.countries.length) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `No country pricing found for shipping method ${sendcloudMethodId}`
        )
      }

      const calculatedAmount = method.countries[0]?.price || 0
      console.log(`[SendcloudProvider] Calculated price: ${calculatedAmount}`)

      return {
        calculated_amount: calculatedAmount,
        is_calculated_price_tax_inclusive: false
      }
    } catch (error) {
      console.error("[SendcloudProvider] Error calculating price:", error)
      throw error
    }
  }

  private mapOrderItems(
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO>
  ): MappedOrderItem[] {
    console.log("[SendcloudProvider] Mapping order items...")
    const orderItemsToFulfill: MappedOrderItem[] = []
  
    items.forEach((item) => {
      // @ts-ignore - we need this since the types don't fully match
      const orderItem = order.items?.find((i) => i.id === item.line_item_id)
  
      if (!orderItem) {
        console.warn(`[SendcloudProvider] No matching order item found for line_item_id: ${item.line_item_id}`)
        return
      }
  
      console.log("[SendcloudProvider] Processing order item:", {
        id: orderItem.id,
        variant_id: orderItem.variant_id,
        product_id: orderItem.product_id
      })
  
      // Try to get weight - first from variant, then from product
      let variantWeight = 0
      
      // @ts-ignore - accessing nested data
      const variantData = orderItem?.variant
      // @ts-ignore - accessing nested data
      const productData = variantData?.product
  
      if (variantData?.weight) {
        variantWeight = Number(variantData.weight)
        console.log(`[SendcloudProvider] Found weight in variant: ${variantWeight}g`)
      } else if (productData?.weight) {
        variantWeight = Number(productData.weight)
        console.log(`[SendcloudProvider] Found weight in product: ${variantWeight}g`)
      } else {
        console.log("[SendcloudProvider] No weight found in variant or product, using default weight")
        variantWeight = 500 // Default to 500g if no weight is set
      }
  
      orderItemsToFulfill.push({
        ...orderItem,
        quantity: item.quantity || 1,
        weight: variantWeight
      } as MappedOrderItem)
    })
  
    console.log("[SendcloudProvider] Mapped items with weights:", 
      orderItemsToFulfill.map(item => ({
        id: item.id,
        weight: item.weight,
        quantity: item.quantity
      }))
    )
  
    return orderItemsToFulfill
  }
  
  private calculateTotalWeight(items: MappedOrderItem[]): string {
    console.log("[SendcloudProvider] Calculating total weight for items...")

    const totalGrams = items.reduce((sum, item) => {
      const weight = Number(item.weight || 0)
      const quantity = item.quantity || 1
      const itemTotalWeight = weight * quantity

      console.log("[SendcloudProvider] Item weight calculation:", {
        item_id: item.id,
        weight_in_grams: weight,
        quantity,
        item_total_weight: itemTotalWeight
      })

      return sum + itemTotalWeight
    }, 0)

    const weightInKg = Math.max(totalGrams / 1000, 0.001).toFixed(3)
    console.log(`[SendcloudProvider] Final weight calculation: ${totalGrams}g = ${weightInKg}kg`)

    return weightInKg
  }

  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    console.log("[SendcloudProvider] Creating fulfillment:", {
      orderItems: items.length,
      orderId: order?.id,
      fullData: JSON.stringify({ data, fulfillment }, null, 2) // Debug log
    })

    if (!order?.shipping_address) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Shipping address is required for creating Sendcloud parcel"
      )
    }

    // Extract sendcloud_id from the data object's nested structure
    const sendcloudMethodId = (data?.data as Record<string, unknown>)?.sendcloud_id
    
    if (!sendcloudMethodId) {
      console.error("[SendcloudProvider] Missing sendcloud_id in data:", JSON.stringify(data, null, 2))
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Sendcloud shipping method ID is required"
      )
    }

    try {
      const orderItemsToFulfill = this.mapOrderItems(items, order)
      if (!orderItemsToFulfill.length) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "No valid items to fulfill"
        )
      }

      const totalWeight = this.calculateTotalWeight(orderItemsToFulfill)

      if (
        !order.shipping_address.address_1 ||
        !order.shipping_address.city ||
        !order.shipping_address.postal_code ||
        !order.shipping_address.country_code
      ) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Missing required address fields"
        )
      }

      const countryCode = order.shipping_address.country_code.toUpperCase()

      const parcelData = {
        parcel: {
          name: `${order.shipping_address.first_name || ""} ${order.shipping_address.last_name || ""}`.trim(),
          address: order.shipping_address.address_1,
          house_number: order.shipping_address.address_2 || "0",
          city: order.shipping_address.city,
          postal_code: order.shipping_address.postal_code,
          telephone: order.shipping_address.phone || undefined,
          email: order.email || undefined,
          country: countryCode,
          shipment: {
            id: Number(sendcloudMethodId)
          },
          weight: totalWeight,
          order_number: order.id || "",
          request_label: false
        }
      }

      console.log("[SendcloudProvider] Sending parcel data to Sendcloud:", JSON.stringify(parcelData, null, 2))

      const response = await this.client_.createParcel(parcelData)

      console.log("[SendcloudProvider] Successfully created parcel:", {
        parcelId: response.parcel.id,
        trackingNumber: response.parcel.tracking_number
      })

      return {
        data: {
          parcel_id: response.parcel.id,
          tracking_number: response.parcel.tracking_number,
          shipping_label: response.parcel.label?.normal_printer?.[0],
          carrier: response.parcel.carrier?.code,
          status: response.parcel.status?.message
        },
        labels: [
          {
            tracking_number: response.parcel.tracking_number || "",
            tracking_url: "",
            label_url: response.parcel.label?.normal_printer?.[0] || ""
          }
        ]
      }
    } catch (error) {
      console.error("[SendcloudProvider] Error creating fulfillment:", error)
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Error creating Sendcloud parcel: ${error.message}`
      )
    }
  }

  async cancelFulfillment(
    fulfillment: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    console.log("[SendcloudProvider] Cancelling fulfillment:", fulfillment)
    
    const fulfillmentData = fulfillment.data as Record<string, unknown> | undefined
    const parcelId = fulfillmentData?.parcel_id || fulfillment.parcel_id
    
    if (!parcelId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No parcel ID found in fulfillment data"
      )
    }
  
    try {
      await this.client_.cancelParcel(Number(parcelId))
      console.log("[SendcloudProvider] Successfully cancelled parcel:", parcelId)
      return fulfillment
    } catch (error) {
      // Check if the error indicates the parcel is already deleted or doesn't exist
      if (
        error.message?.includes("Parcel has been deleted") || 
        error.message?.includes("No Parcel matches the given query") ||
        error.message?.includes("Gone")
      ) {
        console.log("[SendcloudProvider] Parcel was already deleted or doesn't exist, considering as success")
        return fulfillment
      }
  
      console.error("[SendcloudProvider] Error cancelling fulfillment:", error)
      throw error
    }
  }

  mapSendcloudStatusToFulfillmentStatus(sendcloudStatus: string): string | null {
    // Convert to lowercase and trim for consistent mapping
    const normalizedStatus = (sendcloudStatus || "").toLowerCase().trim()
    
    // Map Sendcloud status to Medusa fulfillment status
    // Possible Medusa fulfillment statuses:
    // - created
    // - shipped
    // - canceled
    // - fulfilled
    // - returned
    // - not_delivered
    // - partially_fulfilled
    // - partially_shipped
    // - requires_action
    
    // Sendcloud statuses documentation: https://panel.sendcloud.sc/api/docs/v2/index.html#tag/Parcels/get/parcels
    
    switch (normalizedStatus) {
      // Initial states - map to 'created'
      case "ready to send":
      case "ready for order":
      case "awaiting label":
      case "new":
      case "data received":
        return "created";
      
      // Announced/registered/handed to carrier - map to 'shipped'
      case "announced":
      case "registered":
      case "announced at carrier":
      case "sent to carrier":
      case "handed to carrier":
      case "picked up by carrier":
        return "shipped";
      
      // In transit states - map to 'shipped'
      case "at sorting":
      case "sorting":
      case "in transit":
      case "with delivery courier":
      case "out for delivery":
      case "ready for pickup":
      case "at pickup point":
        return "shipped";
      
      // Final successful states
      case "delivered":
      case "delivered to pickup point":
      case "picked up at pickup point":
        return "delivered";
      
      // Failed delivery states
      case "delivery attempt failed":
      case "not delivered":
      case "delivery failed":
      case "unable to deliver":
      case "not collected":
        return "not_delivered";
      
      // Cancellation states
      case "cancelled":
      case "canceled":
      case "deleted":
      case "parcel deleted":
        return "canceled";
      
      // Return states
      case "return to sender":
      case "returned":
      case "returned to sender":
        return "returned";
      
      // Default case for unhandled statuses
      default:
        console.log(`[SendcloudProvider] Unmapped Sendcloud status: ${normalizedStatus}`);
        return "shipped"; // Default to shipped as a fallback
    }
  }

  async updateFulfillmentStatus(
    parcelId: number | string, 
    trackingNumber: string, 
    status: string
  ): Promise<void> {
    console.log(`[SendcloudProvider] Updating status for parcel ${parcelId} with status: ${status}`)
    
    if (!parcelId && !trackingNumber) {
      console.warn("[SendcloudProvider] Both parcelId and trackingNumber are missing, cannot update fulfillment")
      return
    }
    
    if (!status) {
      console.warn("[SendcloudProvider] Status is missing, cannot update fulfillment")
      return
    }
    
    try {
      // Map the status
      const fulfillmentStatus = this.mapSendcloudStatusToFulfillmentStatus(status)
      if (!fulfillmentStatus) {
        console.warn(`[SendcloudProvider] Could not map Sendcloud status: ${status} to a Medusa status`)
        return
      }
      
      console.log(`[SendcloudProvider] Mapped Sendcloud status "${status}" to Medusa status "${fulfillmentStatus}"`)
      
      // Find the fulfillment module service
      const fulfillmentModuleService = this.container_.resolve(Modules.FULFILLMENT)
      
      // Find fulfillment by parcel_id or tracking_number
      let query: Record<string, any> = {}
      let searchBy = ""
      
      if (parcelId) {
        query = { "data.parcel_id": parcelId.toString() }
        searchBy = `parcel_id ${parcelId}`
      } else if (trackingNumber) {
        query = { "tracking_number": trackingNumber }
        searchBy = `tracking_number ${trackingNumber}`
      }
      
      console.log(`[SendcloudProvider] Looking for fulfillment with ${searchBy}`)
      
      try {
        // First try with exact match on parcel_id
        const result = await fulfillmentModuleService.listFulfillments({ 
          query
        })
        
        const fulfillments = result?.fulfillments || []
        
        if (fulfillments.length === 0) {
          console.warn(`[SendcloudProvider] No fulfillment found for ${searchBy}`)
          
          // If no exact match was found and we have a tracking number, try with that
          if (parcelId && trackingNumber && query["data.parcel_id"]) {
            console.log(`[SendcloudProvider] Trying to find fulfillment by tracking number: ${trackingNumber}`)
            
            const resultByTracking = await fulfillmentModuleService.listFulfillments({
              query: { "tracking_number": trackingNumber }
            })
            
            const fulfillmentsByTracking = resultByTracking?.fulfillments || []
            
            if (fulfillmentsByTracking.length === 0) {
              console.warn(`[SendcloudProvider] No fulfillment found for tracking number ${trackingNumber} either`)
              return
            }
            
            console.log(`[SendcloudProvider] Found ${fulfillmentsByTracking.length} fulfillments by tracking number`)
            return this.updateMultipleFulfillments(fulfillmentsByTracking, fulfillmentStatus, fulfillmentModuleService)
          }
          
          return
        }
        
        console.log(`[SendcloudProvider] Found ${fulfillments.length} fulfillments by ${searchBy}:`, 
          fulfillments.map((f: any) => ({ id: f.id, status: f.status }))
        )
        
        return this.updateMultipleFulfillments(fulfillments, fulfillmentStatus, fulfillmentModuleService)
        
      } catch (error) {
        console.error(`[SendcloudProvider] Error finding fulfillments:`, error)
        throw error
      }
    } catch (error) {
      console.error("[SendcloudProvider] Error updating fulfillment status:", error)
      throw error
    }
  }

  // Helper method to update multiple fulfillments
  private async updateMultipleFulfillments(
    fulfillments: any[], 
    fulfillmentStatus: string,
    fulfillmentModuleService: any
  ): Promise<void> {
    // For each fulfillment, update the status if needed
    for (const fulfillment of fulfillments) {
      // Check if the status is actually changing
      if (fulfillment.status === fulfillmentStatus) {
        console.log(`[SendcloudProvider] Fulfillment ${fulfillment.id} already has status: ${fulfillmentStatus}`)
        continue
      }
      
      console.log(`[SendcloudProvider] Updating fulfillment ${fulfillment.id} status from ${fulfillment.status} to ${fulfillmentStatus}`)
      
      try {
        // Update the fulfillment status
        await fulfillmentModuleService.updateFulfillment(fulfillment.id, {
          status: fulfillmentStatus
        })
        
        console.log(`[SendcloudProvider] Successfully updated fulfillment ${fulfillment.id} status to ${fulfillmentStatus}`)
      } catch (error) {
        console.error(`[SendcloudProvider] Error updating fulfillment ${fulfillment.id}:`, error)
      }
    }
  }
}

export default SendcloudFulfillmentProviderService