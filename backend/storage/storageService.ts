import { getSupabaseAdmin } from '../supabase/supabaseClient.ts';

export interface StorageAsset {
  name: string;
  bucket: string;
  url: string;
  size?: number;
  mimeType?: string;
}

const DEFAULT_ASSETS: StorageAsset[] = [
  {
    name: 'human_dealer_shuffle_10s.mp4',
    bucket: 'game-assets',
    url: process.env.SHUFFLE_VIDEO_ASSET_URL || '/assets/videos/human_dealer_shuffle_10s.mp4',
    mimeType: 'video/mp4'
  },
  {
    name: 'european_wheel_texture.jpg',
    bucket: 'game-assets',
    url: '/assets/aistudio/european_wheel.jpg',
    mimeType: 'image/jpeg'
  },
  {
    name: 'live_studio_broadcast.jpg',
    bucket: 'media',
    url: '/assets/dealers/dealer_female_croupier_1789757216538.jpg',
    mimeType: 'image/jpeg'
  },
  {
    name: 'croupier_marcus.jpg',
    bucket: 'media',
    url: '/assets/dealers/dealer_male_croupier_1789757231226.jpg',
    mimeType: 'image/jpeg'
  },
  {
    name: 'cards_deck_52.png',
    bucket: 'game-assets',
    url: '/assets/aistudio/cards_deck.png',
    mimeType: 'image/png'
  }
];

export interface UploadedDocument {
  id: string;
  name: string;
  category: 'kyc' | 'receipt' | 'claim' | 'policy' | 'other';
  url: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  googleDriveId?: string;
  status: 'pending' | 'verified' | 'rejected';
}

const memoryDocuments: UploadedDocument[] = [
  {
    id: 'doc_seed_001',
    name: 'Agent_Agency_License_2026.pdf',
    category: 'policy',
    url: '/assets/docs/Agent_Agency_License_2026.pdf',
    size: 245000,
    uploadedBy: 'usr_admin_001',
    uploadedAt: new Date(Date.now() - 86400000).toISOString(),
    status: 'verified'
  },
  {
    id: 'doc_seed_002',
    name: 'UPI_Transfer_Proof_5000.jpg',
    category: 'receipt',
    url: '/assets/docs/UPI_Transfer_Proof_5000.jpg',
    size: 184000,
    uploadedBy: 'usr_brix_8849',
    uploadedAt: new Date(Date.now() - 3600000).toISOString(),
    status: 'pending'
  }
];

export const storageService = {
  // Get public or direct URL for an asset
  async getAssetUrl(bucket: string, path: string): Promise<string> {
    const admin = getSupabaseAdmin();
    if (admin) {
      try {
        const { data } = admin.storage.from(bucket).getPublicUrl(path);
        if (data?.publicUrl) return data.publicUrl;
      } catch {
        // Fall back to local path
      }
    }

    const matched = DEFAULT_ASSETS.find((a) => a.bucket === bucket && a.name === path);
    if (matched) return matched.url;
    return `/public/assets/${path}`;
  },

  // Authoritative real human shuffle video metadata
  async getShuffleVideoInfo(): Promise<{
    bucket: string;
    path: string;
    url: string;
    durationSeconds: number;
    format: string;
    isStorageBacked: boolean;
    configured: boolean;
  }> {
    const bucket = 'game-assets';
    const path = 'human_dealer_shuffle_10s.mp4';
    const url = await this.getAssetUrl(bucket, path);
    const admin = getSupabaseAdmin();

    let isStorageBacked = false;
    if (admin) {
      try {
        const { data } = await admin.storage.from(bucket).list('', { search: path });
        if (data && data.length > 0) {
          isStorageBacked = true;
        }
      } catch {
        // fallback
      }
    }

    return {
      bucket,
      path,
      url,
      durationSeconds: 10,
      format: 'mp4',
      isStorageBacked,
      configured: Boolean(process.env.SHUFFLE_VIDEO_ASSET_URL || isStorageBacked)
    };
  },

  // Get signed URL for secure/private assets
  async getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string> {
    const admin = getSupabaseAdmin();
    if (admin) {
      try {
        const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, expiresIn);
        if (!error && data?.signedUrl) {
          return data.signedUrl;
        }
      } catch {
        // Fall back
      }
    }
    return this.getAssetUrl(bucket, path);
  },

  // List assets in a bucket
  async listAssets(bucket = 'game-assets'): Promise<StorageAsset[]> {
    const admin = getSupabaseAdmin();
    if (admin) {
      try {
        const { data } = await admin.storage.from(bucket).list();
        if (data && data.length > 0) {
          return data.map((item) => ({
            name: item.name,
            bucket,
            url: admin.storage.from(bucket).getPublicUrl(item.name).data.publicUrl,
            size: item.metadata?.size
          }));
        }
      } catch {
        // fallback
      }
    }

    return DEFAULT_ASSETS.filter((a) => a.bucket === bucket || bucket === 'all');
  },

  // List uploaded documents
  async listDocuments(): Promise<UploadedDocument[]> {
    return [...memoryDocuments];
  },

  // Record document upload
  async recordDocument(doc: Omit<UploadedDocument, 'id' | 'uploadedAt' | 'status'>): Promise<UploadedDocument> {
    const newDoc: UploadedDocument = {
      ...doc,
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      uploadedAt: new Date().toISOString(),
      status: 'pending',
      googleDriveId: process.env.GOOGLE_DRIVE_FOLDER_ID ? `gdrive_${Date.now()}` : undefined
    };
    memoryDocuments.unshift(newDoc);
    return newDoc;
  },

  // Update document status
  async updateDocumentStatus(docId: string, status: 'pending' | 'verified' | 'rejected'): Promise<UploadedDocument | null> {
    const doc = memoryDocuments.find((d) => d.id === docId);
    if (!doc) return null;
    doc.status = status;
    return doc;
  }
};
