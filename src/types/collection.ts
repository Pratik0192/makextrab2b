export interface Collection {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  imagePublicId?: string | null;
  isActive: boolean;
  displayOrder: number;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionRequest {
  name: string;
  description?: string | null;
  isActive?: boolean;
  displayOrder?: number;
}

export type UpdateCollectionRequest = Partial<CreateCollectionRequest>;
