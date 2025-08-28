"use client"

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { myAppHook } from "@/context/AppUtils";

export default function Profile(){

    const { userProfile } = myAppHook();

    console.log(userProfile)

    return <>

        <Navbar />
        

        {
            userProfile ? ( 
            <div className="container mt-5">
                <h2>Profile</h2>
                <div className="card p-4 shadow-sm">
                    <p><strong>Nombre:</strong> { userProfile?.name } </p>
                    <p><strong>Apellido:</strong> { userProfile?.lastName } </p>
                    <p><strong>CUIL:</strong> { userProfile?.cuil } </p>
                    <p><strong>Empleador:</strong> { userProfile?.empleador } </p>
                    <p><strong>Email:</strong> { userProfile?.email } </p>
                    <p><strong>Teléfono:</strong> { userProfile?.phone } </p>                    
                    <p> { userProfile?.isAdmin && ( <span style={{ color: "red", fontWeight: "bold" }}>Usuario Administrador </span>)} </p>
                </div>
            </div>             
            ) : (
                <p>No se encontró ningún perfil</p>
            )
        }

        
        
    </>
}