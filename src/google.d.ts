declare global {
namespace GoogleIdentityServices {
  type CredentialResponse = {
    credential: string
  }

  type IdConfiguration = {
    client_id: string
    callback: (response: CredentialResponse) => void
    error_callback?: (error: { type: string; message?: string }) => void
  }

  type TokenResponse = {
    access_token: string
    expires_in: number
    error?: string
    error_description?: string
  }

  type TokenClientConfiguration = {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: { type: string; message?: string }) => void
  }

  type TokenClient = {
    requestAccessToken: (options?: { prompt?: string }) => void
  }

  type ButtonConfiguration = {
    theme?: 'outline' | 'filled_blue' | 'filled_black'
    size?: 'large' | 'medium' | 'small'
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
    shape?: 'rectangular' | 'pill' | 'circle' | 'square'
    width?: number
  }

  type IdentityApi = {
    initialize: (configuration: IdConfiguration) => void
    renderButton: (parent: HTMLElement, configuration: ButtonConfiguration) => void
    disableAutoSelect: () => void
  }

  type OAuth2Api = {
    initTokenClient: (configuration: TokenClientConfiguration) => TokenClient
    revoke: (token: string, callback?: () => void) => void
  }
}

  interface Window {
    google?: {
      accounts: {
        id: GoogleIdentityServices.IdentityApi
        oauth2: GoogleIdentityServices.OAuth2Api
      }
    }
  }
}

export {}
