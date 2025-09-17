"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import Navbar from "@/components/Navbar"

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // A dónde volverá el usuario para cambiar la clave
      const redirectTo = `${window.location.origin}/auth/update-password`;

      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) throw error;
      toast.success("Email de restablecimiento enviado. Revisa la bandeja (y spam).");
      setEmail("");
    } catch (err: any) {
      toast.error(err?.message || "No se pudo enviar el email.");
    } finally {
      setLoading(false); 
    }
  };

  return <>
    <Navbar />
    {<div className="container mt-5" style={{ maxWidth: 520 }}>
      <h3>Restablecer contraseña</h3>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input
            type="email"
            required
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" disabled={loading}>
          {loading ? "Enviando..." : "Enviar enlace de restablecimiento"}
        </button>
      </form>
    </div>
 
  }
  </>
}
