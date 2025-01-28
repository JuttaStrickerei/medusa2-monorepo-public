import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import SendcloudFulfillmentProviderService from "./service"

// Make sure we export this so we can reference it
export const SENDCLOUD_IDENTIFIER = "sendcloud"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [SendcloudFulfillmentProviderService],
})