"use client";

import dataProviderSimpleRest from "@refinedev/simple-rest";
import { DataProvider, HttpError } from "@refinedev/core";

const API_URL = "/api/v1/admin";

export const createDataProvider = (getToken: () => Promise<string | null>): DataProvider => {
  const storeId = process.env.NEXT_PUBLIC_DEFAULT_STORE_ID || "";
  const baseProvider = dataProviderSimpleRest(API_URL);

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("X-Store-ID", storeId);

    const response = await fetch(url, { ...options, headers });
    return response;
  };

  return {
    ...baseProvider,
    getList: async ({ resource, pagination, filters, sorters, meta }) => {
      const url = `${API_URL}/${resource}`;
      const response = await fetchWithAuth(url);
      
      if (!response.ok) {
        throw { message: "Error fetching list", statusCode: response.status } as HttpError;
      }

      const json = await response.json() as any;
      let data = json.data;
      let total = json.meta?.total || (Array.isArray(data) ? data.length : 0);

      if (resource === 'categories' && data.flat) {
        data = data.flat;
        total = data.length;
      }

      return {
        data,
        total,
      };
    },
    getOne: async ({ resource, id, meta }) => {
      const url = `${API_URL}/${resource}/${id}`;
      const response = await fetchWithAuth(url);
      
      if (!response.ok) {
        throw { message: "Error fetching record", statusCode: response.status } as HttpError;
      }

      const json = await response.json() as any;
      return { data: json.data };
    },
    create: async ({ resource, variables, meta }) => {
      const url = `${API_URL}/${resource}`;
      const response = await fetchWithAuth(url, {
        method: "POST",
        body: JSON.stringify(variables),
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        let message = "Error creating record";
        try {
          const json = await response.json() as any;
          message = json.error?.message || message;
        } catch (e) {
          message = response.statusText || message;
        }
        throw { 
          message, 
          statusCode: response.status 
        } as HttpError;
      }

      const json = await response.json() as any;
      return { data: json.data };
    },
    update: async ({ resource, id, variables, meta }) => {
      const url = `${API_URL}/${resource}/${id}`;
      const response = await fetchWithAuth(url, {
        method: "PATCH",
        body: JSON.stringify(variables),
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        let message = "Error updating record";
        try {
          const json = await response.json() as any;
          message = json.error?.message || message;
        } catch (e) {
          message = response.statusText || message;
        }
        throw { 
          message, 
          statusCode: response.status 
        } as HttpError;
      }

      const json = await response.json() as any;
      return { data: json.data };
    },
    deleteOne: async ({ resource, id, variables, meta }) => {
      const url = `${API_URL}/${resource}/${id}`;
      const response = await fetchWithAuth(url, { method: "DELETE" });

      if (!response.ok) {
        throw { message: "Error deleting record", statusCode: response.status } as HttpError;
      }

      const json = await response.json() as any;
      return { data: json.data };
    },
  };
};
