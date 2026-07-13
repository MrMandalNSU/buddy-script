const avatars = ["img1.png", "img2.png", "img3.png", "img4.png", "img5.png", "img6.png", "img7.png", "img8.png"] as const;
export function avatarForUser(userId: string): string {
  let hash = 2_166_136_261;
  for (const character of userId) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619);
  return `/assets/${avatars[(hash >>> 0) % avatars.length] ?? avatars[0]}`;
}
