import { MedusaError } from "@medusajs/framework/utils"
import { SendcloudOptions } from "./service"

export class SendcloudClient {
  private baseUrl = "https://panel.sendcloud.sc/api/v2"
  private auth: string

  constructor(options: SendcloudOptions) {
    if (!options.public_key || !options.secret_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Sendcloud public_key and secret_key are required"
      )
    }

    console.log("\nInitializing Sendcloud client with credentials:")
    console.log("Public Key:", options.public_key)
    console.log("Secret Key (first 4 chars):", options.secret_key.substring(0, 4))
    
    // Let's try both ways of creating the auth token to compare
    const manualAuth = Buffer.from(
      `${options.public_key}:${options.secret_key}`
    ).toString('base64')
    console.log("Manual auth generation:", manualAuth)
    
    // Try standard way
    const btoa = (str: string) => Buffer.from(str).toString('base64')
    const standardAuth = btoa(`${options.public_key}:${options.secret_key}`)
    console.log("Standard auth generation:", standardAuth)
    
    this.auth = standardAuth
    
    // Verify by decoding
    console.log("Decoded auth (should match credentials):", Buffer.from(this.auth, 'base64').toString())
  }

  private async sendRequest<T>(
    endpoint: string, 
    options?: RequestInit
  ): Promise<T> {
    try {
      console.log(`\nSending request to ${this.baseUrl}${endpoint}`)
      
      const headers = {
        "Authorization": `Basic ${this.auth}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Requested-With": ""
      }
      
      console.log("\nRequest details:")
      console.log("Full URL:", `${this.baseUrl}${endpoint}`)
      console.log("Method:", options?.method || 'GET')
      console.log("Headers:", {
        ...headers,
        "Authorization": "Basic " + this.auth.substring(0, 10) + "..." // Only show part of auth
      })
      if (options?.body) {
        console.log("Body:", options.body)
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      })

      console.log("\nResponse details:")
      console.log("Status:", response.status)
      console.log("Status Text:", response.statusText)
      
      const responseText = await response.text()
      console.log("Raw Response:", responseText)

      if (!response.ok) {
        try {
          const error = JSON.parse(responseText)
          console.error("\nParsed error response:", error)
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Sendcloud API error: ${JSON.stringify(error)}`
          )
        } catch (e) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Sendcloud API error: ${responseText}`
          )
        }
      }

      const responseData = JSON.parse(responseText)
      console.log("\nParsed successful response:", responseData)
      return responseData
    } catch (error) {
      console.error("\nRequest failed:", error)
      throw error
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log("\nTesting Sendcloud connection...")
      await this.sendRequest("/shipping_methods")
      return true
    } catch (error) {
      console.error("\nConnection test failed:", error.message)
      return false
    }
  }

  // Future methods for actual Sendcloud operations will go here
  // Example:
  // async getShippingMethods(): Promise<any> { ... }
  // async createParcel(data: any): Promise<any> { ... }
}