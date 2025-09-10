"use client"

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import * as yup from "yup";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { myAppHook } from "@/context/AppUtils";

const formSchema = yup.object().shape({
    name: yup.string().required("El nombre es obligatorio"),
    lastName: yup.string().required("El apellido es obligatorio"),
    cuil: yup.string().required("El CUIL es obligatorio"),
    empleador: yup.string().required("El nombre de su empleador es obligatorio"),
    email: yup.string().email("Dirección de Email no válida").required("El Email es obligatorio"),
    phone: yup.string().required("El teléfono es obligatorio"),    
    password: yup.string().required("La contraseña es obligatoria").min(6, "La contraseña debe tener al menos 6 caracteres"),
    confirm_password: yup.string().required("La confirmación de la contraseña es obligatoria").oneOf([yup.ref("password")], "Las contraseñas no coinciden")

});

export default function Register(){

    const router = useRouter();
    const { setIsLoading } = myAppHook()

    const { 
       register,
       handleSubmit,
       formState:{
         errors, isSubmitting
       } 
    } = useForm ({
        resolver: yupResolver(formSchema)
    })

    const onSubmit = async (formdata: any) =>{
        
        setIsLoading(true)
        const { name, lastName, cuil, empleador, email, password, phone, isAdmin } = formdata;
        const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name,
                lastName,
                cuil,
                empleador,
                phone,
                isAdmin: false
                }
            }
        });

        if(error){
            toast.error("Failed to register user")
        } else{
            toast.success("Usuario registrado con éxito! Revisa tu correo y confirma tu email (Supabase Auth)", { duration: 4000 });
            setIsLoading(false)
            router.push("/auth/login");
        }        
    }

    const handleLoginRedirect = () => {
        router.push("/auth/login")    
    }

    return <>

        <Navbar />

        <div className="container mt-5">
            <h2 className="text-center">Registro de usuario</h2>
            <form onSubmit={ handleSubmit(onSubmit) } className="w-50 mx-auto mt-3">
                <div className="row mb-3">
                    <div className="col-md-6">
                        <label className="form-label">Nombre</label>
                        <input type="text" className="form-control" { ...register("name") } />
                        <p className="text-danger">{ errors.name?.message }</p>
                    </div>
                    <div className="col-md-6">
                        <label className="form-label">Apellido</label>
                        <input type="text" className="form-control" { ...register("lastName") } />
                        <p className="text-danger">{ errors.lastName?.message }</p>
                    </div>
                    
                </div>

                <div className="row mb-3">

                    <div className="col-md-6">
                        <label className="form-label">Email</label>
                        <input type="email" className="form-control" { ...register("email") } />
                        <p className="text-danger">{ errors.email?.message }</p>
                    </div>

                    <div className="col-md-6">
                        <label className="form-label">Teléfono</label>
                        <input type="text" className="form-control" { ...register("phone") } />
                        <p className="text-danger">{ errors.phone?.message }</p>
                    </div>                      

                </div>

                 <div className="row mb-3">

                    <div className="col-md-6">
                        <label className="form-label">CUIL</label>
                        <input type="text" className="form-control" { ...register("cuil") } />
                        <p className="text-danger">{ errors.cuil?.message }</p>
                    </div>

                    <div className="col-md-6">
                        <label className="form-label">Empleador</label>
                        <input type="text" className="form-control" { ...register("empleador") } />
                        <p className="text-danger">{ errors.empleador?.message }</p>
                    </div>


          
                </div>

                <div className="row mb-3">
                    <div className="col-md-6">
                        <label className="form-label">Password</label>
                        <input type="password" className="form-control" { ...register("password") } />
                        <p className="text-danger">{ errors.password?.message }</p>
                    </div>

                    <div className="col-md-6">
                        <label className="form-label">Confirm Password</label>
                        <input type="password" className="form-control" { ...register("confirm_password") } />
                        <p className="text-danger">{ errors.confirm_password?.message }</p>
                    </div>
                </div>

                <button type="submit" className="btn btn-primary w-100">Registrtarse</button>
            </form>

            <p className="text-center mt-3 text-blue-500 hover:underline" style={{ fontWeight: "bold", cursor: "pointer" }} >
                ¿Ya tienes una cuenta? <a onClick={ handleLoginRedirect } className="text-center mt-3 text-blue-500 hover:underline">Iniciar sesión</a>
            </p>
        </div>   
         
    </>
}