// src/modules/sendcloud/types.ts

// Price and Currency Types
export type SendcloudPriceBreakdown = {
  type: 'price_without_insurance' | 'fuel' | string
  label: string
  value: number
}

// Shipping Method Types
export type SendcloudShippingMethod = {
  id: number
  name: string
  carrier: string
  min_weight: string
  max_weight: string
  service_point_input: 'required' | 'none'
  price: number
  countries: SendcloudCountry[]
}

export type SendcloudCountry = {
  id: number
  name: string
  price: number
  iso_2: string
  iso_3: string
  lead_time_hours: number | null
  price_breakdown?: SendcloudPriceBreakdown[]
}

export type SendcloudShippingMethodsResponse = {
  shipping_methods: SendcloudShippingMethod[]
}

// Parcel Types
export type SendcloudParcelStatus = {
  id: number
  message: string
}

export type SendcloudLabel = {
  normal_printer: string[]
  label_printer?: string
}

export type SendcloudParcelResponse = {
  id: number
  name: string
  company_name?: string
  address: string
  address_divided?: {
    street: string
    house_number: string
  }
  city: string
  postal_code: string
  telephone?: string
  email?: string
  status: SendcloudParcelStatus
  tracking_number?: string
  label?: SendcloudLabel
  weight: string
  carrier: {
    code: string
  }
  documents?: Array<{
    type: string
    size: string
    link: string
  }>
  shipment: {
    id: number
    name: string
  }
  order_number?: string
  colli_uuid?: string
}

export type SendcloudCreateParcelRequest = {
  parcel: {
    name: string
    company_name?: string
    address: string
    house_number: string
    city: string
    postal_code: string
    telephone?: string
    email?: string
    country: string
    shipment: {
      id: number
    }
    weight: string
    order_number?: string
    request_label: boolean
  }
}

export type SendcloudCreateParcelResponse = {
  parcel: SendcloudParcelResponse
}

export type SendcloudCancelResponse = {
  status: string
  message: string
}

// Error Types
export type SendcloudError = {
  message: string
  code?: string
}

export type SendcloudErrorResponse = {
  error: SendcloudError
  errors?: SendcloudError[]
}