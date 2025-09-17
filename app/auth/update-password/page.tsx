"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar"

export default function UpdatePasswordPage() {
  const [ready, setReady] = useState(false); // true cuando podemos cambiar la pass
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let subscription: any = null;

    (async () => {
      // 1) Si la URL tiene fragmento (#access_token=...&type=recovery), intenta setear la sesión (fallback)
      const hash = window.location.hash; // ejemplo: #access_token=...&refresh_token=...&type=recovery
      if (hash) {
        const params = new URLSearchParams(hash.replace(/^#/, "?"));
        const type = params.get("type");
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");

        if (type === "recovery" && access_token && refresh_token) {
          // opcional: setear la sesión manualmente si no fue parseada por el cliente
          try {
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            } as any); // setSession espera {access_token, refresh_token}
            if (!error) {
              // borra el fragmento de la URL para no exponer tokens
              history.replaceState(null, "", window.location.pathname);
              setReady(true);
            }
          } catch (err) {
            console.warn("setSession fallback falló", err);
          }
        }
      }

      // 2) Registrar listener: Supabase emite PASSWORD_RECOVERY cuando llega el link
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          // ya podemos mostrar el formulario para cambiar la contraseña
          setReady(true);
          // borra hash por seguridad (si no se borró antes)
          try { history.replaceState(null, "", window.location.pathname); } catch(e) {}
        }
      });

      subscription = data.subscription;
    })();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPassword !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      // updateUser hace el cambio de contraseña para el usuario autenticado en esta sesión
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      toast.success("Contraseña actualizada. Ya podés iniciar sesión.");
      router.push("/auth/login"); // o la ruta que uses para login
    } catch (err: any) {
      toast.error(err?.message || "No se pudo actualizar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  return <>
     <Navbar />

{    <div className="container mt-5" style={{ maxWidth: 520 }}>
      <h3>Crear nueva contraseña</h3>

      {!ready ? (
        <div className="alert alert-info">
          Preparando formulario... Si abriste el enlace desde el email en otra pestaña, espera un momento. Si continua sin funcionar, prueba abrir el enlace en la misma pestaña del navegador.
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label>Nueva contraseña</label>
            <input
              type="password"
              className="form-control"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div className="mb-3">
            <label>Confirmar contraseña</label>
            <input
              type="password"
              className="form-control"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Guardando..." : "Actualizar contraseña"}
          </button>
        </form>
      )}
    </div>}
    </>
}
