import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-600 text-3xl font-black text-white">
        R
      </div>
      <h1 className="mt-6 text-2xl font-bold text-white">Página no encontrada</h1>
      <p className="mt-2 text-gray-400">La página que buscas no existe</p>
      <Link href="/" className="mt-6 rounded-xl bg-pink-600 px-6 py-3 text-sm font-semibold text-white hover:bg-pink-700">
        Volver al inicio
      </Link>
    </div>
  );
}
