import { 
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
      console.log("Sendcloud getFulfillmentOptions called!")
      return [{
        id: "sendcloud_standard",
        name: "Sendcloud Standard Shipping",
        provider_id: "sendcloud",
        data: {},
      }]
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
  
  export default SendcloudFulfillmentProviderService








  /*Ideen: 
  
  Hat schon funktioniert:
  import { 
  AbstractFulfillmentProviderService 
} from "@medusajs/framework/utils"
import { 
  FulfillmentItemDTO,
  FulfillmentOrderDTO,
  CreateFulfillmentResult,
  Logger
} from "@medusajs/framework/types"
import axios from "axios"

/**
 * Sendcloud API Integration Reference
 * 
 * API Details:
 * URL: https://panel.sendcloud.sc/api/v2/parcels
 * Method: POST
 * Headers: {
 *   'Content-Type': 'application/json',
 *   'Authorization': 'Basic {base64(public_key:secret_key)}'
 * }

type SendcloudOptions = {
    public_key: string
    secret_key: string
  }
  
  class SendcloudFulfillmentProviderService extends AbstractFulfillmentProviderService {
    static identifier = "sendcloud"
    protected readonly options_: SendcloudOptions
    protected readonly logger_: Logger
  
    constructor(
      container: Record<string, unknown>,
      options: SendcloudOptions
    ) {
      super()
      this.options_ = options
      this.logger_ = container.logger as Logger
    }
  
    async getFulfillmentOptions(): Promise<any[]> {
      try {
        const response = await axios.get(
          "https://panel.sendcloud.sc/api/v2/shipping_methods",
          {
            headers: this.getRequestHeaders(),
            params: { to_country: "NL" } // TODO: Make this configurable
          }
        )
        
        return response.data.shipping_methods.map(method => ({
          id: `sendcloud_${method.id}`,
          name: method.name,
          provider_id: "sendcloud",
          data: {
            sendcloud_id: method.id,
            ...method
          }
        }))
      } catch (error) {
        this.logger_.error("Error fetching Sendcloud shipping methods: " + error)
        return []
      }
    }
  
    async validateOption(data: Record<string, unknown>): Promise<boolean> {
      return true // TODO: Implement proper validation
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
      if (!order || !order.shipping_address) {
        throw new Error("Order or shipping address not found")
      }
  
      try {
        const parcelData = {
          parcel: {
            name: `${order.shipping_address.first_name} ${order.shipping_address.last_name}`,
            company_name: order.shipping_address.company,
            address: order.shipping_address.address_1,
            address_2: order.shipping_address.address_2,
            house_number: order.shipping_address.address_2, // TODO: Parse from address if needed
            city: order.shipping_address.city,
            postal_code: order.shipping_address.postal_code,
            country: {
              iso_2: order.shipping_address.country_code?.toUpperCase()
            },
            telephone: order.shipping_address.phone,
            email: order.email,
            order_number: order.display_id,
            external_reference: order.id,
            shipping_method: data.sendcloud_id as number,
            weight: this.calculateTotalWeight(items),
            parcel_items: this.formatParcelItems(items),
            request_label: true
          }
        }
  
        const response = await axios.post(
          "https://panel.sendcloud.sc/api/v2/parcels",
          parcelData,
          {
            headers: this.getRequestHeaders()
          }
        )
  
        return {
          data: {
            sendcloud_id: response.data.parcel.id,
            tracking_number: response.data.parcel.tracking_number,
            ...response.data.parcel
          },
          labels: [] // TODO: Handle label data if needed
        }
  
      } catch (error) {
        this.logger_.error("Error creating Sendcloud fulfillment: " + error)
        throw error
      }
    }
  
    async cancelFulfillment(fulfillment: Record<string, unknown>): Promise<Record<string, unknown>> {
      try {
        if (!fulfillment.data?.sendcloud_id) {
          throw new Error("No Sendcloud parcel ID found")
        }
  
        await axios.post(
          `https://panel.sendcloud.sc/api/v2/parcels/${fulfillment.data.sendcloud_id}/cancel`,
          {},
          {
            headers: this.getRequestHeaders()
          }
        )
  
        return {
          success: true
        }
      } catch (error) {
        this.logger_.error("Error cancelling Sendcloud fulfillment: " + error)
        throw error
      }
    }
  
    private getRequestHeaders() {
      const authToken = Buffer.from(
        `${this.options_.public_key}:${this.options_.secret_key}`
      ).toString('base64')
  
      return {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authToken}`,
        'Accept': 'application/json'
      }
    }
  
    private calculateTotalWeight(items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[]) {
      return items.reduce((total, item) => {
        return total + ((item.variant?.product?.weight || 0) * (item.quantity || 1))
      }, 0)
    }
  
    private formatParcelItems(items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[]) {
      return items.map(item => ({
        description: item.title,
        quantity: item.quantity,
        weight: item.variant?.product?.weight,
        value: item.unit_price ? item.unit_price / 100 : 0,
        product_id: item.variant?.product?.id
      }))
    }
  }
  
  export default SendcloudFulfillmentProviderService
  
  */




  /**
 * Sendcloud Parcel Creation Reference
 * 
 * API Details:
 * URL: https://panel.sendcloud.sc/api/v2/parcels
 * Method: POST
 * Headers: {
 *   'Content-Type': 'application/json',
 *   'Authorization': 'Basic {base64(public_key:secret_key)}'
 * }
 * 
 * Example Request:
 * const response = await fetch('https://panel.sendcloud.sc/api/v2/parcels', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': 'Basic {base64(public_key:secret_key)}'
 *   },
 *   body: JSON.stringify({
 *     "parcel": {
 *       // Medusa Order/Fulfillment Data Mapping:
 *       "order_number": "", // <- fulfillment.order.display_id
 *       "external_order_id": "", // <- fulfillment.order.id
 *       
 *       // Shipping Details from Medusa:
 *       "name": "", // <- fulfillment.delivery_address.first_name + last_name
 *       "company_name": "", // <- fulfillment.delivery_address.company
 *       "address": "", // <- fulfillment.delivery_address.address_1
 *       "address_2": "", // <- fulfillment.delivery_address.address_2
 *       "city": "", // <- fulfillment.delivery_address.city
 *       "postal_code": "", // <- fulfillment.delivery_address.postal_code
 *       "telephone": "", // <- fulfillment.delivery_address.phone
 *       "email": "", // <- order.email
 *       "country": {
 *         "iso_2": "", // <- fulfillment.delivery_address.country_code
 *       },
 *       
 *       // Fixed or Configurable Values:
 *       "weight": "10.000", // Will need weight calculation from items
 *       "shipping_method": 8, // Will come from shipping option config
 *       "shipping_method_checkout_name": "DHL Express Domestic",
 *       
 *       // Optional but useful fields:
 *       "reference": "0",
 *       "total_order_value": "11.11",
 *       "total_order_value_currency": "EUR", // <- order.currency_code
 *       
 *       // Required default values:
 *       "is_return": false,
 *       "quantity": 1,
 *       "parcel_items": [],
 *       "documents": [],
 *       
 *       // Address division (might be needed for some carriers)
 *       "address_divided": {
 *         "street": "Stadhuisplein",
 *         "house_number": "10"
 *       }
 *     }
 *   })
 * });
 * 
 * Expected Successful Response:
 * {
 *   "parcel": {
 *     "id": 438239975,
 *     "status": {
 *       "id": 999,
 *       "message": "No label"
 *     },
 *     "tracking_number": "",
 *     // ... other fields returned
 *   }
 * }
 * 
 * Note: This will be implemented in the createFulfillment method 
 * where we have access to the fulfillment and order data from Medusa.
 */



  /**
 * Sendcloud Parcel Creation Reference Payload
 * This is a reference for future implementation of the Sendcloud API integration
 * Endpoint: POST https://panel.sendcloud.sc/api/v2/parcels
 * 
 * Example payload structure:
 * {
 *   parcel: {
 *     // Parcel Identification
 *     id: number,                    // Sendcloud parcel ID
 *     reference: string,             // Custom reference
 *     order_number: string,          // Order reference number
 *     external_order_id: string,     // External system order ID
 *     external_reference: string,    // Additional reference
 *     
 *     // Shipment Details
 *     shipping_method: number,       // Sendcloud shipping method ID
 *     shipment: {
 *       id: number,                  // Shipping method ID
 *       name: string                 // Shipping method name
 *     },
 *     shipping_method_checkout_name: string,
 *     
 *     // Package Information
 *     weight: string,                // Weight in grams
 *     length: number|null,           // Optional dimensions
 *     width: number|null,
 *     height: number|null,
 *     
 *     // Status and Tracking
 *     status: {
 *       id: number,                  // Status ID
 *       message: string              // Status message
 *     },
 *     tracking_number: string,
 *     
 *     // Delivery Address
 *     address_divided: {
 *       street: string,
 *       house_number: string
 *     },
 *     address: string,               // Full street address
 *     address_2: string,             // Additional address info
 *     city: string,
 *     postal_code: string,
 *     country: {
 *       iso_2: string,               // Two-letter country code
 *       iso_3: string,               // Three-letter country code
 *       name: string
 *     },
 *     
 *     // Contact Information
 *     name: string,                  // Recipient name
 *     company_name: string,
 *     email: string,
 *     telephone: string,
 *     
 *     // Additional Details
 *     parcel_items: any[],          // Items in parcel
 *     documents: any[],             // Attached documents
 *     total_order_value: string,    // Order value
 *     total_order_value_currency: string,
 *     is_return: boolean,
 *     note: string,
 *     
 *     // Carrier Information
 *     carrier: {
 *       code: string                // Carrier identifier
 *     }
 *   }
 * }
 */