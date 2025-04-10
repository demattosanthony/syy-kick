import { PublicClientApplication, AccountInfo, InteractionRequiredAuthError, BrowserCacheLocation } from "@azure/msal-browser";

const configuration = {
    auth: {
        clientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID!,
    },
    cache: {
        cacheLocation: BrowserCacheLocation.LocalStorage,
        storeAuthStateInCookie: true,
        secureCookies: process.env.NODE_ENV === "production",
    }
}

export const msalInstance = new PublicClientApplication(configuration);

const ensureInitialized = async () => {
    if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length > 0) {
        msalInstance.setActiveAccount(msalInstance.getAllAccounts()[0]);
    }
}

export const getAccessToken = async (messageData?: any) => {
    // TODO
};
