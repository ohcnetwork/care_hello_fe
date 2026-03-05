export type UserBareMinimum = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  read_profile_picture_url?: string;
  external_id: string;
  is_superuser: boolean;
};

export interface FacilityModel {
  id?: string;
  name?: string;
  read_cover_image_url?: string;
  facility_type?: string;
  address?: string;
  features?: number[];
  location?: {
    latitude: number;
    longitude: number;
  };
  phone_number?: string;
  middleware_address?: string;
  modified_date?: string;
  created_date?: string;
  state?: number;
  district?: number;
  local_body?: number;
  ward?: number;
  pincode?: string;
  latitude?: string;
  longitude?: string;
  kasp_empanelled?: boolean;
  patient_count?: number;
  bed_count?: number;
}
