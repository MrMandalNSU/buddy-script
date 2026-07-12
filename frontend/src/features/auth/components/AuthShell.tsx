import Image from "next/image";

export function AuthShell({ kind, children }: { kind: "login" | "register"; children: React.ReactNode }) {
  const artwork = kind === "login" ? "/assets/login.png" : "/assets/registration.png";
  return <main className={`auth-shell auth-shell--${kind}`}>
    <Image className="auth-shape auth-shape--one" src="/assets/shape1.svg" alt="" width={154} height={155} aria-hidden />
    <Image className="auth-shape auth-shape--two" src="/assets/shape2.svg" alt="" width={250} height={255} aria-hidden />
    <Image className="auth-shape auth-shape--three" src="/assets/shape3.svg" alt="" width={195} height={215} aria-hidden />
    <div className="auth-layout">
      <div className="auth-artwork" aria-hidden><Image src={artwork} alt="" width={780} height={650} priority /></div>
      <section className="auth-card">{children}</section>
    </div>
  </main>;
}
