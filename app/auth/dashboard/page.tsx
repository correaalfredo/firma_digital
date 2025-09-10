"use client";

import Footer from "@/components/Footer"
import Navbar from "@/components/Navbar"
import Image from "next/image"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient";
import { myAppHook } from "@/context/AppUtils";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import Swal from "sweetalert2";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FaFilter, FaTimes, FaFileExcel, FaFilePdf } from "react-icons/fa";
 
 
 

interface  PayslipType {
  id: number,
  cuil: string,
  fullname: string,
  payroll_period: string,
  payslip_url_pdf: string | File | null,
  email_employee: string,
  cuit: string,
  company_name: string,
  pdf_name?:string,
  signed?: boolean,
}


const formSchema = yup.object().shape({
  cuil: yup
    .string()
    .required("Ingrese el CUIL del empleado")
    .matches(/^[0-9]{11}$/, "El CUIL debe contener solo números (11 dígitos)"),  
  /* fullname: yup.string().required("El nombre y apellido es obligatorio"), */
  payroll_period: yup.string().required("Ingrese el periodo de liquidación"),
  payslip_url_pdf: yup
    .mixed()
    .test("required", "El recibo de sueldo es obligatorio", (value) => {
        return value instanceof File || typeof value === "string";
    })
    .test("fileType", "El archivo debe ser un PDF", (value) => {
        if (value instanceof File) return value.type === "application/pdf";
        return true; // Si ya es string (URL), no valida tipo
    }),
  email_employee: yup.string().required("Ingrese el email del empleado"),  
  cuit: yup.string().required("Ingrese el CUIT del empleador"),
  company_name: yup.string().required("Ingrese la denominación del empleador"),    
});

export default function Dashboard(){

    const [previewImage, setPreviewImage] = useState<null>(null)
    const [payslips, setPayslips] = useState<PayslipType | null>(null)
    const [userId, setUserId] = useState<null | string>(null);
    const [isUserAdmin, setIsUserAdmin] = useState<null  | boolean  >(null);
    const [userEmail, setUserEmail] = useState<null | string>(null);
    const [editId, setEditId] = useState(null);
    const [cuilEncontrado, setCuilEncontrado] = useState(false);
    const [filterPeriod, setFilterPeriod] = useState(""); // formato "YYYY-MM"
    

    const {setAuthToken, setIsLoggedIn, isLoggedIn, setUserProfile, setIsLoading} = myAppHook()
    const router = useRouter();

    const { register, reset, setValue, handleSubmit, formState: { 
        errors 
    } } = useForm({
        resolver: yupResolver(formSchema)
    })

    useEffect( () =>{
        const handleLoginSession = async() => {

            const {data, error} = await supabase.auth.getSession();

            if(error){
                toast.error("Failed to get user data") 
                router.push("/auth/login");
                return;   
            }

            setIsLoading(true)
            if(data.session?.access_token){
               
                setAuthToken(data.session?.access_token);    
                setUserId(data.session?.user.id);
                setIsUserAdmin(data.session?.user?.user_metadata.isAdmin);
                setUserEmail(data.session?.user?.user_metadata.email);

               
                localStorage.setItem("access_token", data.session?.access_token);
                setIsLoggedIn(true);
                setUserProfile({
                    name: data.session.user?.user_metadata.name,
                    lastName: data.session.user?.user_metadata.lastName,
                    cuil: data.session.user?.user_metadata.cuil,
                    empleador: data.session.user?.user_metadata.empleador,
                    email: data.session.user?.user_metadata.email,                    
                    phone: data.session.user?.user_metadata.phone,
                    isAdmin: data.session.user?.user_metadata.isAdmin,
                });

                 
                //toast.success("User logged in successfully");
                localStorage.setItem("user_profile", JSON.stringify ({
                    name: data.session.user?.user_metadata.name,
                    lastName: data.session.user?.user_metadata.lastName,
                    cuil: data.session.user?.user_metadata.cuil,
                    empleador: data.session.user?.user_metadata.empleador,
                    email: data.session.user?.user_metadata.email,                    
                    phone: data.session.user?.user_metadata.phone,
                    isAdmin: data.session.user?.user_metadata.isAdmin,
                }))

                fetchPayslipsFromTable(data.session.user.id, data.session?.user?.user_metadata.isAdmin, data.session?.user?.user_metadata.email)
            }      
             setIsLoading(false)      
        }       

        handleLoginSession()

         if(!isLoggedIn){
            router.push("/auth/login");
            return;
        }
    }, []);

    

    // Upload Banner Image
    const uploadImageFile = async(file: File) => {  // banner.jpg

    const fileExtension = file.name.split(".").pop();
    const fileName = `${ Date.now() }.${ fileExtension }`;

    const {data, error} = await supabase.storage.from("product-images").upload(fileName, file)

    if(error){
        toast.error("Failed to upload banner image");
        return null;
    }

    return supabase.storage.from("product-images").getPublicUrl(fileName).data.publicUrl;
}

   // Form Submit
    const onFormSubmit = async (formData: any) => {

        setIsLoading(true)

        let imagePath = formData.payslip_url_pdf;
        let pdfName = null;

        if(formData.payslip_url_pdf instanceof File){

            const file = formData.payslip_url_pdf;
            imagePath = await uploadImageFile(file)
            pdfName = file.name; // 👈 guardamos el nombre del archivo
            if(!imagePath) return;
        }

        if(editId){
           // Edit Operation
            const { 
                data, error
            } = await supabase.from("payslips").update({
                ...formData,
                payslip_url_pdf: imagePath,
                pdf_name: pdfName || formData.pdf_name // si no se subió archivo nuevo, mantiene el anterior
            }).match({
                id: editId,
                user_id: userId
            })

            if(error){ 
                toast.error("Error al actualizar la carga!")
            } else{
                toast.success("Carga actualizada correctamente!");
            }
        } else{
            //Add Operation
                const {data, error} = await supabase.from("payslips").insert({
                ...formData,
                user_id: userId,
                payslip_url_pdf: imagePath,
                pdf_name: pdfName
            });

            if(error){ 
                toast.error("Error al cargar el recibo!")
            } else { 
                toast.success("Carga correcta!");
            }
            reset()

        }

        setPreviewImage(null)
        fetchPayslipsFromTable(userId!, isUserAdmin!, userEmail!)
        setIsLoading(false)
    }

    const fetchPayslipsFromTable = async (userId: string, isUserAdmin: boolean, userEmail: string) => {

        setIsLoading(true)
             
        let data, error;

        console.log("->>>", userId, isUserAdmin, userEmail )
        
        if (isUserAdmin) {  
        ({ data, error } = await supabase
            .from("payslips")
            .select("*")
            .eq("user_id", userId)
            .order("payroll_period", { ascending: false })
            .order("cuil", { ascending: true })
            .order("fullname", { ascending: true }));
            //console.log(data)
        } else {
        (            
            { data, error } = await supabase
            .from("payslips")
            .select("*")
            .eq("email_employee", userEmail)
            .order("payroll_period", { ascending: false })
            .order("cuil", { ascending: true })
            .order("fullname", { ascending: true }));
            //console.log(data)
        }  
        
        if(data){
            setPayslips(data)
        }

        setIsLoading(false)
    }

    //Edit Data
    const handleEditData = (payslip: PayslipType) => {

        setValue("cuil", payslip.cuil)
        setValue("fullname", payslip.fullname)
        setValue("payroll_period", payslip.payroll_period)
        setValue("payslip_url_pdf", payslip.payslip_url_pdf)
        setPreviewImage(payslip.payslip_url_pdf)
        setValue("email_employee", payslip.email_employee)
        setValue("cuit", payslip.cuit)
        setValue("company_name", payslip.company_name)        
        setEditId(payslip.id!)
    }

    // Delete Payslip Operation   
    const handleDeletePayslip = (id: number) => {

        Swal.fire({
            title: "Are you sure?",
            text: "You won't be able to revert this!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Yes, delete it!"
            }).then(async (result) => {
            if (result.isConfirmed) {
                const {data, error} = await supabase.from("payslips").delete().match({
                    id: id,
                    user_id: userId
                })

                if(error){
                    toast.error("Error al intentar eliminar la carga del recibo!")
                } else{
                   toast.success("Carga eliminada correctamente!")
                   fetchPayslipsFromTable(userId!, isUserAdmin!, userEmail!)
                }                
            }
            });

    } 

    const applyPeriodFilter = async () => {
        if (!userId) return;

        let query 
        if (isUserAdmin){
            (query = supabase.from("payslips").select("*").eq("user_id", userId)
                    .order("payroll_period", { ascending: false })
                    .order("cuil", { ascending: true })
                    .order("fullname", { ascending: true }));}
        else{
            (query = supabase.from("payslips").select("*").eq("email_employee", userEmail)
                    .order("payroll_period", { ascending: false })
                    .order("cuil", { ascending: true })
                    .order("fullname", { ascending: true }));}

        if (filterPeriod) {
            query = query.eq("payroll_period", filterPeriod);
        }

        // Mantener siempre el orden original
        const { data, error } = await query
            .order("payroll_period", { ascending: false }) // último periodo primero
            .order("cuil", { ascending: true })
            .order("fullname", { ascending: true });

        if (data) setPayslips(data);
        if (!data || data.length === 0) {
            toast("Sin registros para el período", { icon: "ℹ️" });
            setPayslips(null);
            return;
        }
    };

     const clearFilter = () => {
        setFilterPeriod(""); // limpiar el input
        if (userId) fetchPayslipsFromTable(userId!, isUserAdmin!, userEmail!); // volver a cargar todos los registros
    };

    const exportToExcel = async () => {
        if (!payslips || payslips.length === 0) {
            toast.error("No hay datos para exportar");
            return;
        }

        // Crear workbook y hoja
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Recibos");

        // Encabezados
        worksheet.columns = [
            { header: "Periodo", key: "payroll_period", width: 15 },
            { header: "Empleador", key: "company_name", width: 25 },
            { header: "CUIT", key: "cuit", width: 15 },
            { header: "CUIL", key: "cuil", width: 15 },
            { header: "Nombre", key: "fullname", width: 25 },
            { header: "Firmado", key: "signed", width: 10 },
            { header: "Nombre PDF", key: "pdf_name", width: 20 },
            { header: "Email", key: "email_employee", width: 25 },
            { header: "URL PDF", key: "payslip_url_pdf", width: 40 },
        ];

        // Datos
        payslips.forEach(p => {
            worksheet.addRow({
            payroll_period: p.payroll_period,
            company_name: p.company_name,
            cuit: p.cuit,
            cuil: p.cuil,
            fullname: p.fullname,
            signed: p.signed ? "Sí" : "No",
            pdf_name: p.pdf_name || "N/A",
            email_employee: p.email_employee || "N/A",
            payslip_url_pdf: p.payslip_url_pdf || "N/A",
            });
        });

        // Estilo encabezados
        worksheet.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF16A085" }, // verde
            };
        });

        // Generar buffer y descargar
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/octet-stream" });
        saveAs(blob, `reporte_recibos_${filterPeriod || "todos"}.xlsx`);
    };

    const exportToPDF = () => {
        if (!payslips || payslips.length === 0) {
            toast.error("No hay datos para exportar");
            return;
        }

        const doc = new jsPDF({
            orientation: "landscape", // más espacio horizontal
            unit: "pt",
            format: "A4",
        });

        // Encabezado
        doc.setFontSize(16);
        doc.text("Reporte de Recibos de Sueldo", 40, 40);
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleString()}`, 40, 60);

        // Definir columnas y filas
        const tableColumn = [
            "Periodo",
            "Empleador",
            "CUIT",
            "CUIL",
            "Nombre",
            "Firmado",
            "Nombre PDF",
            "Email",
        ];

        const tableRows = payslips.map(p => [
            p.payroll_period,
            p.company_name,
            p.cuit,
            p.cuil,
            p.fullname,
            p.signed ? "Sí" : "No",
            p.pdf_name || "N/A",
            p.email_employee || "N/A",
        ]);

        // Generar tabla
        autoTable(doc, {
            startY: 80,
            head: [tableColumn],
            body: tableRows,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [22, 160, 133], textColor: 255 }, // verde con texto blanco
            alternateRowStyles: { fillColor: [240, 240, 240] },
        });

        // Guardar PDF
        doc.save(`reporte_recibos_${filterPeriod || "todos"}.pdf`);
    };


    const handleSignedPayslip = async (payslipId: number) => {
        if (!payslips) return;

        // Buscar el recibo correspondiente
        const selected = payslips.find(p => p.id === payslipId);
        if (!selected || !selected.payslip_url_pdf) return;

        // 1️⃣ Actualizar la columna "signed" en Supabase
        const { data, error } = await supabase
            .from("payslips")
            .update({ signed: true })
            .eq("id", payslipId);

        if (error) {
            toast.error("Error al firmar el recibo.");
            return;
        }

        // 2️⃣ Actualizar el estado local para reflejar el cambio inmediatamente
        setPayslips(prev => prev?.map(p => 
            p.id === payslipId ? { ...p, signed: true } : p
        ) || null);

        toast.success("Recibo firmado correctamente.");

         // 3️⃣ Descargar PDF correctamente usando fetch
        try {
            const response = await fetch(selected.payslip_url_pdf as string);
            if (!response.ok) throw new Error("Error al descargar el PDF");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.download = selected.pdf_name || `recibo_${selected.payroll_period}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            toast.error("No se pudo descargar el PDF.");
        }
    };

    


    const { userProfile } = myAppHook();
    
    return <>

        <Navbar />

        <div className="container mt-5">
            <div className="row">
            
            <div className="col-md-3">
                {userProfile?.isAdmin ? (
                    <>
                        <h3>{editId ? "Editar recibo de sueldo" : "Cargar recibo de sueldo"}</h3>
                        <form onSubmit={handleSubmit(onFormSubmit)}>
                            
                            <div className="mb-3">
                                <label className="form-label">CUIL</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Ingrese CUIL"
                                    {...register("cuil")}
                                    onBlur={async (e) => {
                                    const cuil = e.target.value;                       
                                    if (cuil.length === 11) {
                                        // Buscar en la tabla de empleados
                                        const { data, error } = await supabase
                                        .from("payslips")
                                        .select("fullname, email_employee, cuit, company_name")
                                        .eq("cuil", cuil)
                                        .limit(1)
                                        .single();

                                        if (error && !editId) {  
                                            toast.error("CUIL no encontrado");
                                            setValue("fullname", ""); // limpio si no existe
                                            setValue("email_employee", ""); // limpio si no existe
                                            setValue("cuit", ""); // limpio si no existe
                                            setValue("company_name", ""); // limpio si no existe
                                            setCuilEncontrado(false);   // 👉 editable
                                        } else {
                                            // Concatenar nombre y apellido
                                            const nombreCompleto = `${data.fullname}`;
                                            setValue("fullname", nombreCompleto);
                                           
                                            // email del empleado
                                            const email = `${data.email_employee}`;
                                            setValue("email_employee", email);

                                            // CUIT del empleador
                                            const cuit_empleador = `${data.cuit}`;
                                            setValue("cuit", cuit_empleador);

                                            // Denominación del empleador
                                            const denominacion_empleador = `${data.company_name}`;
                                            setValue("company_name", denominacion_empleador);

                                            setCuilEncontrado(true);    // 👉 bloquea edición
                                        }
                                    }
                                    }}
                                />
                                <small className="text-danger">{errors.cuil?.message}</small>
                            </div>

                            <div className="mb-3">
                                <label className="form-label">Nombre y Apellido del Empleado</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    {...register("fullname")}
                                    readOnly={cuilEncontrado && !editId}   // ✅ ahora depende del estado
                                />
                                <small className="text-danger">{errors.fullname?.message}</small>
                            </div>
        

                            {/* email_employee */}                            
                            <div className="mb-3">
                                <label className="form-label">Correo Electrónico del Empleado</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    {...register("email_employee")}
                                    readOnly={cuilEncontrado && !editId}   // ✅ editable si no lo encontró
                                />
                                <small className="text-danger">{errors.email_employee?.message}</small>
                            </div>

                            {/* cuit */}                            
                            <div className="mb-3">
                                <label className="form-label">CUIT del Empleador</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    {...register("cuit")}
                                    readOnly={cuilEncontrado && !editId}   // ✅ editable si no lo encontró
                                />
                                <small className="text-danger">{errors.cuit?.message}</small>
                            </div>

                             {/* company_name */}                            
                            <div className="mb-3">
                                <label className="form-label">Denominación del Empleador</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    {...register("company_name")}
                                    readOnly={cuilEncontrado && !editId}   // ✅ editable si no lo encontró
                                />
                                <small className="text-danger">{errors.company_name?.message}</small>
                            </div>



                        <div className="mb-3">
                        <label className="form-label">Periodo de liquidación</label>
                        <input
                            type="month"
                            className="form-control"
                            {...register("payroll_period")}
                        />
                        <small className="text-danger">{ errors.payroll_period?.message }</small>
                        </div>
                        <div className="mb-3">
                            <label className="form-label">Recibo de sueldo (PDF)</label>

                                <input
                                    type="file"
                                    className="form-control"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setValue("payslip_url_pdf", file, { shouldValidate: true }); // <-- importante
                                        }
                                    }}
                                />
                            <small className="text-danger">{ errors.payslip_url_pdf?.message }</small>
                        </div>
                        <button type="submit" className="btn btn-success w-100 mb-5">
                            { editId  ? "Actualizar carga" : "Cargar"}
                        </button>
                        </form> 
                    </>
                    ) : (
                        <div className="mb-3">
                             <h5> Nombre: {userProfile?.name} { userProfile?.lastName }</h5> 
                             <h5> CUIL: {userProfile?.cuil}</h5> 
                        </div>
                    )
                }
            </div>
        
             
           <div className="col-md-9 mt-1 table-responsive">
                <div className="d-flex gap-2 align-items-center flex-wrap mb-3">
                    
                    <input 
                    type="month" 
                    className="form-control w-auto" 
                    value={filterPeriod} 
                    onChange={(e) => setFilterPeriod(e.target.value)}/>

                    <button className="btn btn-primary d-flex align-items-center gap-2" onClick={applyPeriodFilter}>
                        <FaFilter /> Filtrar
                    </button>

                    <button className="btn btn-secondary d-flex align-items-center gap-2" onClick={clearFilter}>
                        <FaTimes /> Quitar filtro
                    </button>

                    <button className="btn btn-success d-flex align-items-center gap-2" onClick={exportToExcel}>
                        <FaFileExcel /> Exportar a Excel
                    </button>

                    <button className="btn btn-danger d-flex align-items-center gap-2" onClick={exportToPDF}>
                        <FaFilePdf /> Exportar a PDF
                    </button>
                </div>                  


                {userProfile?.isAdmin ? (
                         <h3>Recibos de sueldos enviados</h3>                     
                    ) : (<h3>Recibos de sueldos</h3>)
                }

                
                <table className="table table-bordered mb-5">
                <thead>
                    <tr>
                    <th>Períodos</th>
                    <th>Empleador</th>   
                    <th>CUIL</th>  
                    <th>Apellido&nbsp;y&nbsp;nombre</th>  
                    <th>¿Firmado?</th>
                    <th>Recibo</th>
                    <th className="text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {
                        payslips ?  payslips.map( (singlePayslip, index) => ( 
                            <tr key={ index }>
                                    <td>{ singlePayslip.payroll_period }</td>
                                    <td>{ `${ singlePayslip.cuit } - ${ singlePayslip.company_name }` }</td>
                                    <td>{ singlePayslip.cuil }</td>
                                    <td>{ singlePayslip.fullname }</td> 
                                    <td>{ singlePayslip.signed ? "Sí" : "No" }</td>                                                                      
                                    <td className="text-center">                                       
                                            {singlePayslip.payslip_url_pdf ? (
                                                <a href={singlePayslip.payslip_url_pdf} target="_blank" rel="noopener noreferrer">
                                                    <img src="/logo_pdf.png" alt="Ver PDF" className="img-fluid" style={{ maxWidth: "30px" }} />
                                                </a>
                                            ) : ("--")}
                                    </td>
                                    {userProfile?.isAdmin ? (
                                            <td className="d-flex">
                                                <button className="btn btn-primary btn-sm me-2" onClick={() => handleEditData(singlePayslip)}>Editar</button>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeletePayslip(singlePayslip.id!)}>Borrar</button>
                                            </td>
                                            ):( <td className="d-flex">
                                                    {/* <button className="btn btn-primary btn-sm me-2" onClick={() => handleEditData(singlePayslip)}>Ver</button> */}
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleSignedPayslip(singlePayslip.id!)}>Firmar y Descargar</button>
                                                </td>
                                              )
                                    }        
                            </tr>
                        ) )   : (
                            <tr>
                                <td colSpan={5} className="text-center">Archivos no encontrados.</td>
                            </tr>
                        )
                    }
                    
                   
                </tbody>
                </table>
            </div>
            </div>
        </div>

                       
            
    </>
}