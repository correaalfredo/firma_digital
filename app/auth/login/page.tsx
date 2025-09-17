"use client";

import Footer from "@/components/Footer"
import Navbar from "@/components/Navbar"
import { supabase } from "@/lib/supabaseClient"
import { useEffect } from "react";
import toast from "react-hot-toast"
import { myAppHook } from "@/context/AppUtils";
import { useRouter } from "next/navigation";
import * as yup from "yup"
import {useForm} from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup";

const formSchema = yup.object().shape({
  email: yup.string().required("Ingrese su Email").email("Dirección de correo electrónico no válida"),
  password: yup.string().required("Ingrese su Password")
});

export default function Login(){

    const router = useRouter();
    const { isLoggedIn, setIsLoggedIn, setAuthToken, setIsLoading } = myAppHook();

    const {
        register,
        handleSubmit,
        formState: { 
            isSubmitting, errors 
        }
    } = useForm({
        resolver: yupResolver(formSchema)
    })

    useEffect( () => {

        if(isLoggedIn){ 
            router.push("/auth/dashboard");
            return;
        }
    }, [isLoggedIn])

    const handleSocialOauth = async(provider: "google") => {

        const {data, error} = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/auth/dashboard`
            }    
        });

        if(error){
            toast.error("Failed to login via Social Oauth");        
        }
    }

    const onSubmit = async (formData: any) => {

        setIsLoading(true)

        const { email, password } = formData;

        const { data, error } = await supabase.auth.signInWithPassword({
            email, password
        })

        
        if (error) {
            toast.error("Usuario o contraseña incorrectos o Email aún no validado!")
            setIsLoading(false) 
        } else {
            if(data.session?.access_token){
                
                setAuthToken(data.session?.access_token);    
                localStorage.setItem("access_token", data.session?.access_token);
                setIsLoggedIn(true);
                setIsLoading(false)
                toast.success("Inicio de sesión exitoso");                
            }
        }
   }

   const handleRegisterRedirect = () => {
        router.push("/auth/register");
   }

    return <>

        {/* <Navbar /> */}

<div className="container-fluid d-flex align-items-center bg-light mt-5">
  <div className="row w-100"> 
    {/* Columna izquierda con logo / imagen */}
    <div className="col-md-6 d-flex flex-column justify-content-center align-items-center text-center p-5">
      <img src="/logo_estudio.png" alt="Mi Logo" style={{ maxWidth: "200px" }} />
      <h2 className="mt-3 text-primary">Firma digital de recibos</h2>
      <p className="text-muted">
        Firma tus recibos en segundos, con total seguridad.
      </p>
    </div>

    {/* Columna derecha con el formulario */}
    <div className="col-md-6 d-flex justify-content-center align-items-center">
      <div className="card shadow-lg p-4" style={{ maxWidth: "400px", width: "100%" }}>
        <h3 className="text-center mb-4">Iniciar sesión</h3>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-3">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" {...register("email")} />
            <p className="text-danger">{errors.email?.message}</p>
          </div>

          <div className="mb-3"> 
            <label className="form-label">Contraseña</label>
            <input type="password" className="form-control" {...register("password")} />
            <p className="text-danger">{errors.password?.message}</p>
          </div>

          <button type="submit" className="btn btn-primary w-100">
            Ingresar
          </button>
          
        </form>

                  <div className="text-center mt-3">
          <button 
            onClick={() => handleSocialOauth("google")} 
            className="btn d-flex align-items-center justify-content-center mx-auto"
            style={{
              backgroundColor: "white",
              border: "1px solid #ddd",
              borderRadius: "6px",
              padding: "10px 15px",
              fontWeight: 500,
              color: "#444",
              width: "100%",
              maxWidth: "250px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}
          >
            <img 
              src="https://www.svgrepo.com/show/355037/google.svg" 
              alt="Google Logo" 
              style={{ width: "20px", marginRight: "10px" }} 
            />
            Iniciar sesión con Google
          </button>
        </div>

        <p className="text-center mt-3">
          <a 
            href="/auth/reset-password" 
            className="text-sm text-blue-500 hover:underline block mb-2"
          >
            ¿Has olvidado la contraseña?
        </a>  
        </p> 

        <p className="text-center mt-1">
          ¿No tienes una cuenta?{" "}
          <a onClick={handleRegisterRedirect} style={{ fontWeight: "bold", cursor: "pointer" }} className="text-blue-500 hover:underline">
            Registrarse
          </a>          
        </p>


      </div>
    </div>
  </div>
</div>

        
    </>
}