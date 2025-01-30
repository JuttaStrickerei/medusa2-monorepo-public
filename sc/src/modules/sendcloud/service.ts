import { 
  AbstractFulfillmentProviderService
} from "@medusajs/framework/utils"
import { 
  FulfillmentItemDTO,
  FulfillmentOrderDTO,
  CreateFulfillmentResult,
  FulfillmentOption
} from "@medusajs/framework/types"
import { SendcloudClient } from "./client"

export type SendcloudOptions = {
  public_key: string
  secret_key: string
}

class SendcloudFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = "sendcloud"
  protected client_: SendcloudClient
  protected options_: SendcloudOptions

  constructor(container, options: SendcloudOptions) {
    super()
    this.options_ = options
    this.client_ = new SendcloudClient(options)
    
    if (process.env.NODE_ENV === 'development') {
      // Only test connection in development
      this.client_.testConnection()
        .then((success) => {
          if (!success) {
            console.error("Failed to connect to Sendcloud")
          }
        })
    }
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    try {
      console.log("Fetching shipping methods from Sendcloud...")
  
      const response = await this.client_.getShippingMethods({
        from_country: "NL", // TODO: Make configurable
        to_country: "DE"    // TODO: Make configurable
      })
  
      console.log(`Successfully received ${response.shipping_methods.length} shipping methods from Sendcloud.`)
  
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
  
      console.log(`Created ${shippingOptions.length} fulfillment options from the shipping methods.`)
  
      return shippingOptions
    } catch (error) {
      console.error("Error fetching Sendcloud shipping methods:", error)
      return []
    }
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    // Ensure the shipping method exists and is valid
    const shippingMethods = await this.getFulfillmentOptions()
    return shippingMethods.some(method => method.id === data.id)
  }

  async validateFulfillmentData(
    optionData: Record<string, unknown>, 
    data: Record<string, unknown>, 
    context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return {
      ...optionData,
      ...data
    }
  }

  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    // TODO: Implement actual Sendcloud parcel creation
    return {
      data: {
        provider_id: "sendcloud",
        ...data
      },
      labels: []
    }
  }

  async cancelFulfillment(
    fulfillment: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // TODO: Implement actual Sendcloud cancellation
    return {}
  }
}

export default SendcloudFulfillmentProviderService

  /*import { 
    AbstractFulfillmentProviderService
  } from "@medusajs/framework/utils"

  import { 
    FulfillmentItemDTO,
    FulfillmentOrderDTO,
    CreateFulfillmentResult
  } from "@medusajs/framework/types"

  import { SendcloudClient } from "./client"


  export type SendcloudOptions = {
    public_key: string
    secret_key: string
  }
  
  class SendcloudFulfillmentProviderService extends AbstractFulfillmentProviderService {
    static identifier = "sendcloud"
    protected client_: SendcloudClient
    protected options_: SendcloudOptions
  
    constructor(container, options: SendcloudOptions) {
      super()
      console.log("Sendcloud options received:", {
        public_key: options.public_key,
        secret_key: options.secret_key?.slice(0, 4) + "..." // Only log first 4 chars for security
      })
      
      this.options_ = options
      this.client_ = new SendcloudClient(options)
      
      // Test the connection when initializing
      this.client_.testConnection()
        .then((success) => {
          if (success) {
            console.log("Successfully connected to Sendcloud")
          } else {
            console.error("Failed to connect to Sendcloud")
          }
        })
    }
  
    async getFulfillmentOptions(): Promise<any[]> {
      try {
        // Get shipping methods from Sendcloud
        const response = await this.client_.getShippingMethods({
          from_country: "NL",  // You might want to make this configurable
          to_country: "DE"     // You might want to make this configurable
        })
    
        // Transform Sendcloud shipping methods into Medusa fulfillment options
        return response.shipping_methods.map(method => ({
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
      } catch (error) {
        console.error("Error fetching Sendcloud fulfillment options:", error)
        return [] // Return empty array on error
      }
    }
  
    async validateOption(data: Record<string, unknown>): Promise<boolean> {
      console.log("Sendcloud validateOption called!", { data })
      return true
    }
  
    async validateFulfillmentData(
      optionData: Record<string, unknown>, 
      data: Record<string, unknown>, 
      context: Record<string, unknown>
    ): Promise<Record<string, unknown>> {
      console.log("Sendcloud validateFulfillmentData called!", { optionData, data, context })
      return {}
    }
  
    async createFulfillment(
      data: Record<string, unknown>,
      items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
      order: Partial<FulfillmentOrderDTO> | undefined,
      fulfillment: Record<string, unknown>
    ): Promise<CreateFulfillmentResult> {
      console.log("Sendcloud createFulfillment called!", { data, items, order, fulfillment })
      return {
        data: {
          provider_id: "sendcloud",
          ...data
        },
        labels: []
      }
    }
  
    async cancelFulfillment(fulfillment: Record<string, unknown>): Promise<Record<string, unknown>> {
      console.log("Sendcloud cancelFulfillment called!", { fulfillment })
      return {}
    }
  }
  
  export default SendcloudFulfillmentProviderService*/