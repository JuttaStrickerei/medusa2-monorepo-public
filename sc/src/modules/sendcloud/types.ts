// src/modules/sendcloud/types.ts

export type SendcloudPriceBreakdown = {
    type: string
    label: string
    value: number
  }
  
  export type SendcloudCountry = {
    id: number
    name: string
    price: number
    iso_2: string
    iso_3: string
    lead_time_hours: number | null
    price_breakdown: SendcloudPriceBreakdown[]
  }
  
  export type SendcloudShippingMethod = {
    id: number
    name: string
    carrier: string
    min_weight: string
    max_weight: string
    service_point_input: string
    price: number
    countries: SendcloudCountry[]
  }
  
  export type SendcloudShippingMethodsResponse = {
    shipping_methods: SendcloudShippingMethod[]
  }