const RENDER_ROOT = 'https://render.albiononline.com/v1/item';
const MAXIMUM_SIZE = 217;

/** Builds a render URL. Does not download the image. */
export function iconUrl(
  uniqueName: string,
  quality: number,
  size = 100,
): string {
  const suffix = /@([0-4])$/.exec(uniqueName);
  const baseName = uniqueName.replace(/@[0-4]$/, '');
  const enchantment = suffix?.[1] ? Number(suffix[1]) : 0;
  const id = enchantment > 0 ? `${baseName}@${enchantment}` : baseName;
  const safeQuality = quality < 1 ? 1 : quality;
  const safeSize = size > MAXIMUM_SIZE ? MAXIMUM_SIZE : size;
  return `${RENDER_ROOT}/${id}.png?quality=${safeQuality}&size=${safeSize}`;
}
