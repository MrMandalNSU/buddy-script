import Image from "next/image";

export function AuthShell({ kind, children }: { kind: "login" | "register"; children: React.ReactNode }) {
  const artwork = kind === "login" ? "/assets/login.png" : "/assets/registration.png";
  const artworkSize = kind === "login" ? { width: 1269, height: 1240 } : { width: 1928, height: 1422 };
  return <main className={`auth-shell auth-shell--${kind}`}>
    <Image className="auth-shape auth-shape--one" src="/assets/shape1.svg" alt="" width={176} height={540} aria-hidden />
    <Image className="auth-shape auth-shape--two" src="/assets/shape2.svg" alt="" width={568} height={400} aria-hidden />
    <Image className="auth-shape auth-shape--three" src="/assets/shape3.svg" alt="" width={568} height={548} aria-hidden />
    <div className="auth-layout">
      <div className="auth-artwork" aria-hidden><Image src={artwork} alt="" width={artworkSize.width} height={artworkSize.height} priority /></div>
      <section className="auth-card">{children}</section>
    </div>
  </main>;
}
