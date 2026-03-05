type methods = "POST" | "GET" | "PATCH" | "DELETE" | "PUT";

type options = {
  formdata?: boolean;
  external?: boolean;
  headers?: any;
  auth?: boolean;
  signal?: AbortSignal;
};
const CARE_ACCESS_TOKEN_LOCAL_STORAGE_KEY = "care_access_token";

export interface PaginatedResponse<T> {
  next: string | null;
  previous: string | null;
  count: number;
  results: T[];
}

interface DisplayCode {
  display?: string;
}

export interface AllergyIntolerance {
  code?: DisplayCode;
  category?: string;
  clinical_status?: string;
  verification_status?: string;
  criticality?: string;
  last_occurrence?: string;
  note?: string;
}

export interface Symptom {
  code?: DisplayCode;
  clinical_status?: string;
  verification_status?: string;
  severity?: string;
  onset?: {
    onset_datetime?: string;
  };
  note?: string;
}

export interface Diagnosis {
  code?: DisplayCode;
  clinical_status?: string;
  verification_status?: string;
  severity?: string;
  onset?: {
    onset_datetime?: string;
  };
}

export interface MedicationRequest {
  medication?: DisplayCode;
  status?: string;
  intent?: string;
  category?: string;
  priority?: string;
  dosage_instruction?: Array<{
    text?: string;
    route?: DisplayCode;
    dose_and_rate?: {
      dose_quantity?: {
        value?: number | string;
        unit?: DisplayCode;
      };
    };
  }>;
  note?: string;
  authored_on?: string;
}

export interface MedicationStatement {
  medication?: DisplayCode;
  status?: string;
  dosage_text?: string;
  information_source?: string;
  reason?: string;
  note?: string;
  effective_period?: {
    start?: string;
    end?: string;
  };
}

export interface ServiceRequest {
  code?: DisplayCode;
  title?: string;
  status?: string;
  intent?: string;
  priority?: string;
  category?: string;
  body_site?: DisplayCode;
  occurance?: string;
  patient_instruction?: string;
  note?: string;
}

const request = async <T>(
  endpoint: string,
  method: methods = "GET",
  data: any = {},
  options: options = {},
): Promise<T> => {
  const CARE_BASE_URL = window.CARE_API_URL;

  const { formdata, external, headers, auth: isAuth, signal } = options;

  let url = external ? endpoint : CARE_BASE_URL + endpoint;
  let payload: null | string = formdata ? data : JSON.stringify(data);

  if (method === "GET") {
    const requestParams = data
      ? `?${Object.keys(data)
          .filter((key) => data[key] !== null && data[key] !== undefined)
          .map((key) => `${key}=${data[key]}`)
          .join("&")}`
      : "";
    url += requestParams;
    payload = null;
  }

  const localToken = localStorage.getItem(CARE_ACCESS_TOKEN_LOCAL_STORAGE_KEY);

  const auth =
    isAuth === false || typeof localToken === "undefined" || localToken === null
      ? ""
      : "Bearer " + localToken;

  const response = await fetch(url, {
    method: method,
    headers: external
      ? { ...headers }
      : {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: auth,
          ...headers,
        },
    body: payload,
    signal,
  });
  try {
    const txt = await response.clone().text();
    if (txt === "") {
      return {} as any;
    }
    const json = await response.clone().json();
    if (json && response.ok) {
      return json;
    } else {
      throw json;
    }
  } catch (error) {
    throw { error };
  }
};

export const API = {
  nurseAssistant: {
    listAllergies: ({
      patientId,
      selectedEncounterId,
      selectedEncounterStatus,
      signal,
    }: {
      patientId: string;
      selectedEncounterId?: string;
      selectedEncounterStatus?: string;
      signal: AbortSignal;
    }) =>
      request<PaginatedResponse<AllergyIntolerance>>(
        `/api/v1/patient/${patientId}/allergy_intolerance/`,
        "GET",
        {
          encounter:
            selectedEncounterStatus === "completed"
              ? selectedEncounterId
              : undefined,
          limit: 100,
          offset: 0,
        },
        { signal },
      ),
    listSymptoms: ({
      patientId,
      selectedEncounterId,
      signal,
    }: {
      patientId: string;
      selectedEncounterId?: string;
      signal: AbortSignal;
    }) =>
      request<PaginatedResponse<Symptom>>(
        `/api/v1/patient/${patientId}/symptom/`,
        "GET",
        {
          encounter: selectedEncounterId,
          limit: 100,
          offset: 0,
          ordering: "-created_date",
        },
        { signal },
      ),
    listDiagnoses: ({
      patientId,
      selectedEncounterId,
      signal,
    }: {
      patientId: string;
      selectedEncounterId?: string;
      signal: AbortSignal;
    }) =>
      request<PaginatedResponse<Diagnosis>>(
        `/api/v1/patient/${patientId}/diagnosis/`,
        "GET",
        {
          encounter: selectedEncounterId,
          category: "encounter_diagnosis,chronic_condition",
          limit: 100,
          offset: 0,
          ordering: "-created_date",
        },
        { signal },
      ),
    listMedications: ({
      patientId,
      selectedEncounterId,
      facilityId,
      signal,
    }: {
      patientId: string;
      selectedEncounterId?: string;
      facilityId?: string;
      signal: AbortSignal;
    }) =>
      request<PaginatedResponse<MedicationRequest>>(
        `/api/v1/patient/${patientId}/medication/request/`,
        "GET",
        {
          encounter: selectedEncounterId,
          facility: facilityId,
          product_type: "medication",
          limit: 100,
          offset: 0,
          ordering: "-created_date",
        },
        { signal },
      ),
    listMedicationStatements: ({
      patientId,
      signal,
    }: {
      patientId: string;
      signal: AbortSignal;
    }) =>
      request<PaginatedResponse<MedicationStatement>>(
        `/api/v1/patient/${patientId}/medication/statement/`,
        "GET",
        {
          limit: 100,
          offset: 0,
          ordering: "-created_date",
        },
        { signal },
      ),
    listServiceRequests: ({
      selectedEncounterId,
      facilityId,
      signal,
    }: {
      selectedEncounterId?: string;
      facilityId: string;
      signal: AbortSignal;
    }) =>
      request<PaginatedResponse<ServiceRequest>>(
        `/api/v1/facility/${facilityId}/service_request/`,
        "GET",
        {
          encounter: selectedEncounterId,
          limit: 100,
          offset: 0,
          ordering: "-created_date",
        },
        { signal },
      ),
  },
};
