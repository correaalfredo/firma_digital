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
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import { Table, Pagination } from "react-bootstrap";

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
  cuit: yup
    .string()
    .required("Ingrese el CUIL del empleado")
    .matches(/^[0-9]{11}$/, "El CUIL debe contener solo números (11 dígitos)"),
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
    const [filterCuil, setFilterCuil] = useState("");
    const [pdfFileName, setPdfFileName] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10); // cantidad de filas por página


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

            if(error){ console.log("Actualizar", error)
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

            if(error){  console.log("ERROR CARAGR", error)
                toast.error("Error al cargar el recibo!. El email ya está asociado a otros datos!")
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

    // Edit Payslip Operation con confirmación
    const handleEditData = (payslip: PayslipType) => {

        Swal.fire({
            title: "¿Estás seguro de editar?",
            text: "Se actualizarán los datos de la carga",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Sí, actualizar",
            cancelButtonText: "Cancelar"
        }).then(async (result) => {
            if (result.isConfirmed) {
            
            // Rellenar el formulario con los datos actuales
            setValue("cuil", payslip.cuil);
            setValue("fullname", payslip.fullname);
            setValue("payroll_period", payslip.payroll_period);
            setValue("payslip_url_pdf", payslip.payslip_url_pdf);
            setPreviewImage(payslip.payslip_url_pdf);
            setValue("email_employee", payslip.email_employee);
            setValue("cuit", payslip.cuit);
            setValue("company_name", payslip.company_name);        
            setEditId(payslip.id!);

            toast.success("Datos listos para editar");
            }
        });
    };

    // Delete Payslip Operation   
    const handleDeletePayslip = (id: number) => {

        Swal.fire({
            title: "¿Estás seguro?",  
            text: "¡No podrás revertir esto!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Sí, eliminar",
            cancelButtonText: "Cancelar"
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
        setCurrentPage(1); // siempre que cambie el filtro
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
        const borderStyle = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
            };


        // Encabezados
        worksheet.columns = [
            { header: "Periodo", key: "payroll_period", width: 15 },
            { header: "Empleador", key: "company_name", width: 25 },
            { header: "CUIT del Empleador", key: "cuit", width: 20 },
            { header: "Email del Empleado", key: "email_employee", width: 35 },
            { header: "CUIL del Empleado", key: "cuil", width: 20 },
            { header: "Nombre y Apellido del Empleado", key: "fullname", width: 35 },            
            { header: "Nombre del Archivo PDF", key: "pdf_name", width: 65 },
            { header: "¿Firmado?", key: "signed", width: 10 },  
            { header: "Check ✅", key: "check", width: 10 },        
            /* { header: "URL PDF", key: "payslip_url_pdf", width: 40 }, */
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
            check: "",
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
            cell.border = borderStyle; // 👈 Bordes en encabezados
        });

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) { // evitar repetir sobre encabezado
                row.eachCell(cell => {
                cell.border = borderStyle; // 👈 Bordes en cada celda
                });
            }
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
            "CUIT del Empleador",
            "Email del Empleado",
            "CUIL del Empleado",
            "Nombre y Apellido del Empleado",
            "Nombre del Archivo PDF",
            "Firmado",   
            "Check"  
        ];

        const tableRows = payslips.map(p => [
            p.payroll_period,
            p.company_name,
            p.cuit,
            p.email_employee || "N/A",
            p.cuil,
            p.fullname,
            p.pdf_name || "N/A",    
            p.signed ? "Sí" : "No",                    
        ]);

        // Generar tabla
        autoTable(doc, {
            startY: 80,
            head: [tableColumn],
            body: tableRows,
            styles: { 
                fontSize: 8,
                lineWidth: 0.2,              // grosor del borde
                lineColor: [0, 0, 0],        // color negro
            },
            headStyles: { 
                fillColor: [22, 160, 133],   // verde
                textColor: 255,
                lineWidth: 0.5,              // borde más grueso para encabezado
                lineColor: [0, 0, 0],
            },
            alternateRowStyles: { 
                fillColor: [240, 240, 240]   // gris alternado
            },
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

    
    const openPdfWithWatermark = async (pdfUrl: string) => {
        try {
            // 1️⃣ Descargar el PDF original
            const existingPdfBytes = await fetch(pdfUrl).then(res => res.arrayBuffer());

            // 2️⃣ Cargar PDF con pdf-lib
            const pdfDoc = await PDFDocument.load(existingPdfBytes);

            // 3️⃣ Obtener páginas
            const pages = pdfDoc.getPages();

            // 4️⃣ Preparar fuente
            const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

            // 5️⃣ Agregar **dos marcas de agua** por página
            pages.forEach(page => {
                const { width, height } = page.getSize();

                // Primera marca de agua
                page.drawText("Documento no válido", {
                    x: width / 2 - 210,
                    y: height / 2 - 60 ,
                    size: 50,
                    font: font,
                    color: rgb(1, 0, 0),
                    rotate: degrees(45),
                    opacity: 0.3,
                });

                // Segunda marca de agua, desplazada un poco
                page.drawText("Documento no válido", {
                    x: width / 2 - 200,
                    y: height / 2 - 200,
                    size: 50,
                    font: font,
                    color: rgb(1, 0, 0),
                    rotate: degrees(45),
                    opacity: 0.3,
                });

                // Tercera marca de agua, desplazada un poco
                page.drawText("Documento no válido", {
                    x: width / 2 - 50,
                    y: height / 2 - 200,
                    size: 50,
                    font: font,
                    color: rgb(1, 0, 0),
                    rotate: degrees(45),
                    opacity: 0.3,
                });
                // Cuarta marca de agua, desplazada un poco
                page.drawText("Documento no válido", {
                    x: width / 2 - 80,
                    y: height / 2 - 380,
                    size: 50,
                    font: font,
                    color: rgb(1, 0, 0),
                    rotate: degrees(45),
                    opacity: 0.3,
                });

                // Quinta marca de agua, desplazada un poco
                page.drawText("Documento no válido", {
                    x: width / 2 ,
                    y: height / 2 - 450,
                    size: 50,
                    font: font,
                    color: rgb(1, 0, 0),
                    rotate: degrees(45),
                    opacity: 0.3,
                });

                 // Sexta marca de agua
                page.drawText("Documento no válido", {
                    x: width / 4 - 200,
                    y: height / 2 - 110,
                    size: 50,
                    font: font,
                    color: rgb(1, 0, 0),
                    rotate: degrees(45),
                    opacity: 0.3,
                });
            });

            // 6️⃣ Guardar PDF modificado y abrirlo
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            window.open(url, "_blank");

        } catch (error) {
            console.error("Error al abrir PDF con marcas de agua:", error);
        }
    };


    const applyCuilFilter = async () => {
        if (!userId) return;
        setCurrentPage(1); // siempre que cambie el filtro
        // 🔹 Validar CUIL antes de la consulta
        const filterCuilSchema = yup.object().shape({
            cuil: yup
                .string()
                .notRequired() // permite estar vacío
                .matches(/^[0-9]{11}$/, "El CUIL debe contener solo números (11 dígitos)")
        });

        try {
            await filterCuilSchema.validate({ cuil: filterCuil });
        } catch (err) {
            if (err instanceof yup.ValidationError) {
                toast.error(err.message);
                return; // detener ejecución si no pasa validación
            }
        }

        // 🔹 Limpiar el campo de periodo al aplicar filtro por CUIL
        setFilterPeriod("");

        // 🔹 Consulta Supabase
        let query;
        if (isUserAdmin) {
            query = supabase
                .from("payslips")
                .select("*")
                .eq("user_id", userId)
                .order("payroll_period", { ascending: false })
                .order("cuil", { ascending: true })
                .order("fullname", { ascending: true });
        } else {
            query = supabase
                .from("payslips")
                .select("*")
                .eq("email_employee", userEmail)
                .order("payroll_period", { ascending: false })
                .order("cuil", { ascending: true })
                .order("fullname", { ascending: true });
        }

        if (filterCuil) {
            query = query.eq("cuil", filterCuil);
        }

        const { data, error } = await query;
        if (data) setPayslips(data);

        if (!data || data.length === 0) {
            toast("Sin registros para el CUIL", { icon: "ℹ️" });
            setPayslips(null);
            return;
        }
    };


    const clearCuilFilter = () => {
        setFilterCuil("");
        if (userId) fetchPayslipsFromTable(userId!, isUserAdmin!, userEmail!);
    };

    const handlePeriodChange = (e) => {
        setFilterPeriod(e.target.value);
        setFilterCuil(""); // Limpiar el CUIL cuando se filtra por periodo
    };


    const handleCuilChange = (e) => {
        setFilterCuil(e.target.value);
        setFilterPeriod(""); // Limpiar el periodo cuando se filtra por CUIL
    };

    // --- PAGINACIÓN ---
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentPayslips = payslips ? payslips.slice(indexOfFirstItem, indexOfLastItem) : [];


    const { userProfile } = myAppHook();
    
    return <>

        <Navbar />

        <div className="container mt-5">
            <div className="row">
            
                <div className={userProfile?.isAdmin ? "col-md-12" : "col-md-3"}>
                    {userProfile?.isAdmin ? (
                        <>
                            <h3>{editId ? "Editar recibo de sueldo" : "Cargar recibo de sueldo"}</h3>
                            <form onSubmit={handleSubmit(onFormSubmit)}>
                                <div className="card p-3 mb-3">
                                    <h5 className="card-title mb-3">Datos del Empleado</h5>
                                    <div className="row">
                                        <div className="col-md-3 mb-3">
                                            {/* cuil */}
                                            <div className="mb-3">
                                                <label className="form-label">CUIL</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="Ingrese CUIL del empleado"
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
                                                            /* setValue("fullname", ""); // limpio si no existe
                                                            setValue("email_employee", ""); // limpio si no existe
                                                            setValue("cuit", ""); // limpio si no existe
                                                            setValue("company_name", ""); // limpio si no existe */
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
                                        </div>    
                                        <div className="col-md-3 mb-3">   
                                            {/* fullname */}           
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
                                        </div> 
                                        <div className="col-md-3 mb-3">                  
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
                                        </div>  
                                        <div className="col-md-3 mb-3">
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
                                        </div>   
                                    </div>    
                                    
                                    <div className="row">
                                        <div className="col-md-3 mb-3">               
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
                                        </div>  
                                        <div className="col-md-3 mb-3">                
                                            {/* period */}  
                                            <div className="mb-3">
                                                <label className="form-label">Periodo de liquidación</label>
                                                <input
                                                    type="month"
                                                    className="form-control"
                                                    {...register("payroll_period")}
                                                />
                                                <small className="text-danger">{ errors.payroll_period?.message }</small>
                                            </div>
                                        </div>  
                                        <div className="col-md-6 mb-3">         
                                            {/* PDF */}  
                                            <div className="mb-3">
                                                <label className="form-label">Recibo de sueldo (PDF)</label>

                                                    <input
                                                        type="file"
                                                        className="form-control"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                setValue("payslip_url_pdf", file, { shouldValidate: true }); // <-- importante
                                                                setPdfFileName(file.name);   // 👈 guarda el nombre
                                                            }else{
                                                                setPdfFileName(null);
                                                            }
                                                        }}
                                                    />
                                                <small className="text-danger">{ errors.payslip_url_pdf?.message }</small>
                                                {/* 👇 mostramos el nombre solo si existe */}
                                                {pdfFileName && (
                                                    <div className="mt-2 text-success">
                                                    Archivo seleccionado: <strong>{pdfFileName}</strong>
                                                    </div>
                                                )}
                                            </div>
                                        </div>                                           
                                    </div>  

                                    <div className="col-md-3 mb-0 mt-0">         
                                            <button 
                                                type="submit" 
                                                className={`w-100 mb-0 ${editId ? "btn btn-warning" : "btn btn-success"}`}
                                                >
                                                { editId ? "Actualizar carga" : "Cargar" }
                                            </button>
                                    </div> 
                                </div> 


                            </form> 
                        </>
                        ) : (
                            <div className="card p-3 mb-3 shadow-sm" style={{ maxWidth: "400px" }}>
                                <h5 className="card-title mb-3">Usuario</h5>
                                <div className="mb-2">
                                    <strong>Nombre y Apellido:</strong> {userProfile?.name} {userProfile?.lastName}
                                </div>
                                {/* <div className="mb-2">
                                    <strong>CUIL:</strong> {userProfile?.cuil}
                                </div> */}
                                <div>
                                    <strong>Email:</strong> {userProfile?.email}
                                </div>
                            </div>
                        )
                    }
                </div>            
                
                <div className="col-md-9 mt-0 ">
                    
                    <div className="row">
                        {/* Card 1 */}
                        <div className="col-md-6">
                            <div className="card p-3 mb-3">
                            <h6 className="card-title">Filtrar por período</h6>
                            <div className="d-flex flex-column gap-3">
                                <div className="d-flex gap-2 align-items-center flex-wrap">
                                <input 
                                    type="month" 
                                    className="form-control form-control-sm w-50" 
                                    value={filterPeriod} 
                                    onChange={handlePeriodChange} 
                                />
                                <button 
                                    className="btn btn-primary btn-sm d-flex align-items-center gap-2" 
                                    onClick={applyPeriodFilter}
                                >
                                    <FaFilter /> Filtrar
                                </button>
                                <button 
                                    className="btn btn-secondary btn-sm d-flex align-items-center gap-2" 
                                    onClick={clearFilter}
                                >
                                    <FaTimes /> Quitar
                                </button>
                                </div>
                            </div>
                            </div>
                        </div>

                        {/* Card 2 (solo admins) */}
                        {isUserAdmin && (
                            <div className="col-md-6">
                            <div className="card p-3 mb-3">
                                <h6 className="card-title">Filtrar por CUIL</h6>
                                <div className="d-flex flex-column gap-3">
                                <div className="d-flex gap-2 align-items-center flex-wrap">
                                    <input 
                                        type="text" 
                                        className="form-control form-control-sm w-50" 
                                        placeholder="CUIL del empleado" 
                                        value={filterCuil} 
                                        onChange={handleCuilChange} 
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                applyCuilFilter();
                                                }
                                            }
                                        } 
                                    />
                                    <button 
                                        className="btn btn-primary btn-sm d-flex align-items-center gap-2" 
                                        onClick={applyCuilFilter}
                                    >
                                        <FaFilter /> Filtrar
                                    </button>
                                    <button 
                                    className="btn btn-secondary btn-sm d-flex align-items-center gap-2" 
                                    onClick={clearCuilFilter}
                                    >
                                    <FaTimes /> Quitar
                                    </button>
                                </div>
                                </div>
                            </div>
                            </div>
                        )}
                    </div>

                        {/* Exportar en otra fila */}
                        <div className="row">
                        <div className="col-md-6">
                            <div className="card p-3 mb-3">
                            <h6 className="card-title">Exportar</h6>
                            <div className="d-flex gap-2">
                                <button className="btn btn-success btn-sm d-flex align-items-center gap-2" onClick={exportToExcel}>
                                <FaFileExcel /> Exportar a Excel
                                </button>
                                <button className="btn btn-danger btn-sm d-flex align-items-center gap-2" onClick={exportToPDF}>
                                <FaFilePdf /> Exportar a PDF
                                </button>
                            </div>
                            </div>
                        </div>
                        </div>             
                </div>
                
                {userProfile?.isAdmin ? (
                            <h3>Recibos de sueldos enviados</h3>                     
                        ) : (<h3>Recibos de sueldos</h3>)}         
                <div className="mt-0 table table-responsive">
                    
                    <Table bordered hover className="table table-bordered mb-5">
                        <thead>
                            <tr>
                            <th>Períodos</th>
                            <th>Empleador</th>   
                            <th>CUIL</th>  
                            <th>Apellido&nbsp;y&nbsp;nombre</th>  
                            <th>¿Firmado?</th>
                            <th>Recibo</th>
                            <th style={{ minWidth: "300px", whiteSpace: "normal" }}>Nombre PDF</th>
                            <th className="text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {
                                payslips ?  currentPayslips.map( (singlePayslip, index) => ( 
                                    <tr key={ index }>
                                            <td>{ singlePayslip.payroll_period }</td>
                                            <td>{ `${ singlePayslip.cuit } - ${ singlePayslip.company_name }` }</td>
                                            <td>{ singlePayslip.cuil }</td>
                                            <td>{ singlePayslip.fullname }</td>                                             
                                            <td className="text-center align-middle"> 
                                                <strong className={singlePayslip.signed ? "text-success" : "text-danger"}>
                                                    {singlePayslip.signed ? "Firmado✔️" : "Pendiente❌"}
                                                </strong>
                                            </td>     
                                            <td className="text-center">                                       
                                                {singlePayslip.payslip_url_pdf ? (
                                                    userProfile?.isAdmin ? (
                                                        // 🔹 Si es Admin → muestra el link directo al PDF
                                                        <a
                                                        href={singlePayslip.payslip_url_pdf}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        >
                                                        <img
                                                            src="/logo_pdf.png"
                                                            alt="Ver PDF"
                                                            className="img-fluid"
                                                            style={{ maxWidth: "30px" }}
                                                        />
                                                        </a>
                                                    ) : (
                                                        // 🔹 Si NO es Admin → botón que abre el PDF con marca de agua
                                                        <button
                                                        className="btn btn-sm btn-info"
                                                        onClick={() =>
                                                            openPdfWithWatermark(singlePayslip.payslip_url_pdf as string)
                                                        }
                                                        >
                                                        Ver PDF
                                                        </button>
                                                    )
                                                    ) : (
                                                    "--"
                                                    )}
                                            </td>
                                            <td>{ singlePayslip.pdf_name }</td> 
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
                    </Table>
                    {payslips && payslips.length > itemsPerPage && (
                        <Pagination className="justify-content-center">
                            <Pagination.First onClick={() => setCurrentPage(1)} disabled={currentPage === 1} />
                            <Pagination.Prev onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} />
                            
                            {Array.from({ length: Math.ceil(payslips.length / itemsPerPage) }, (_, idx) => (
                            <Pagination.Item 
                                key={idx + 1} 
                                active={currentPage === idx + 1} 
                                onClick={() => setCurrentPage(idx + 1)}
                            >
                                {idx + 1}
                            </Pagination.Item>
                            ))}

                            <Pagination.Next 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(payslips.length / itemsPerPage)))} 
                            disabled={currentPage === Math.ceil(payslips.length / itemsPerPage)} 
                            />
                            <Pagination.Last 
                            onClick={() => setCurrentPage(Math.ceil(payslips.length / itemsPerPage))} 
                            disabled={currentPage === Math.ceil(payslips.length / itemsPerPage)} 
                            />
                        </Pagination>
                        )}
                </div> 

            </div>
        </div>
    </>
}