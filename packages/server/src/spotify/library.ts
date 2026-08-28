import { spotifyRequest } from "./client.js";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Which of `ids` are in the user's Liked Songs. */
export async function areTracksSaved(
  ids: string[],
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  for (const group of chunk([...new Set(ids)], 50)) {
    const flags = await spotifyRequest<boolean[]>({
      path: "/me/tracks/contains",
      query: { ids: group.join(",") },
    });
    group.forEach((id, i) => {
      result[id] = flags[i] ?? false;
    });
  }
  return result;
}

export async function isTrackSaved(id: string): Promise<boolean> {
  return (await areTracksSaved([id]))[id] ?? false;
}

export async function saveTrack(id: string): Promise<void> {
  await spotifyRequest({ method: "PUT", path: "/me/tracks", body: { ids: [id] } });
}

export async function removeSavedTrack(id: string): Promise<void> {
  await spotifyRequest({
    method: "DELETE",
    path: "/me/tracks",
    body: { ids: [id] },
  });
}

// --- saved albums -----------------------------------------------------

export async function isAlbumSaved(id: string): Promise<boolean> {
  const flags = await spotifyRequest<boolean[]>({
    path: "/me/albums/contains",
    query: { ids: id },
  });
  return flags[0] ?? false;
}

export async function saveAlbum(id: string): Promise<void> {
  await spotifyRequest({ method: "PUT", path: "/me/albums", body: { ids: [id] } });
}

export async function removeSavedAlbum(id: string): Promise<void> {
  await spotifyRequest({
    method: "DELETE",
    path: "/me/albums",
    body: { ids: [id] },
  });
}
