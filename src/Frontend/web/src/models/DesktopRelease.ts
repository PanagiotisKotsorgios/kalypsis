export interface DesktopReleaseAsset {
  id: number;
  name: string;
  label: string | null;
  contentType: string;
  size: number;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
  browserDownloadUrl: string;
  digest: string | null;
}

export interface DesktopRelease {
  id: number;
  tagName: string;
  name: string;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  createdAt: string;
  publishedAt: string | null;
  htmlUrl: string;
  assets: DesktopReleaseAsset[];
}
