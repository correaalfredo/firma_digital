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

interface ProductType {
  id: number,
  title: string,
  content: string,
  cost: string,
  banner_image: string | File | null
}


const formSchema = yup.object().shape({
  title: yup
    .string()
    .required("Ingrese el CUIL del empleado")
    .matches(/^[0-9]{11}$/, "El CUIL debe contener solo números (11 dígitos)"),  
  /* content: yup.string().required("Description is required"), */
  cost: yup.string().required("Ingrese el periodo de liquidación"),
  banner_image: yup
    .mixed()
    .test("required", "El recibo de sueldo es obligatorio", (value) => {
        return value instanceof File || typeof value === "string";
    })
    .test("fileType", "El archivo debe ser un PDF", (value) => {
        if (value instanceof File) return value.type === "application/pdf";
        return true; // Si ya es string (URL), no valida tipo
    }),
});

export default function Dashboard(){

    const [previewImage, setPreviewImage] = useState<null>(null)
    const [products, setProducts] = useState<ProductType | null>(null)
    const [userId, setUserId] = useState<null | string>(null);
    const [editId, setEditId] = useState(null);

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
                console.log(data);
                setAuthToken(data.session?.access_token);    
                setUserId(data.session?.user.id);
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

                fetchProductsFromTable(data.session.user.id)
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

        let imagePath = formData.banner_image;

        if(formData.banner_image instanceof File){

            imagePath = await uploadImageFile(formData.banner_image)
            if(!imagePath) return;
        }

        if(editId){
           // Edit Operation
            const { 
                data, error
            } = await supabase.from("products").update({
                ...formData,
                banner_image: imagePath
            }).match({
                id: editId,
                user_id: userId
            })

            if(error){
                toast.error("Failed to update product data")
            } else{
                toast.success("Producto has been updated successufully");
            }
        } else{
            //Add Operation
                const {data, error} = await supabase.from("products").insert({
                ...formData,
                user_id: userId,
                banner_image: imagePath
            });

            if(error){ 
                toast.error("Failed to Add product")
            } else { 
                toast.success("Successfully Product has been created!");
            }
            reset()

        }

        setPreviewImage(null)
        fetchProductsFromTable(userId!)
        setIsLoading(false)
    }

    const fetchProductsFromTable = async (userId: string) => {

        setIsLoading(true)
        const {data, error} = await supabase.from("products").select("*").eq("user_id", userId)
        .order("cost", { ascending: false  })     // descendente (último periodo arriba)
        .order("title", { ascending: true })    // después por CUIL ascendente
        .order("content", { ascending: true }); // después por nombre ascendente

        if(data){
            setProducts(data)
        }

        setIsLoading(false)
    }

    //Edit Data
    const handleEditData = (product: ProductType) => {

        setValue("title", product.title)
        setValue("content", product.content)
        setValue("cost", product.cost)
        setValue("banner_image", product.banner_image)
        setPreviewImage(product.banner_image)
        setEditId(product.id!)
    }

    // Delete Product Operation   
    const handleDeleteProduct = (id: number) => {

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
                const {data, error} = await supabase.from("products").delete().match({
                    id: id,
                    user_id: userId
                })

                if(error){
                    toast.error("Failed to delete product")
                } else{
                   toast.success("Product deleted successfully")
                   fetchProductsFromTable(userId!)
                }                
            }
            });

    } 

    return <>

        <Navbar />

        <div className="container mt-5">
            <div className="row">
            
            <div className="col-md-4">
                <h3>{editId ? "Editar recibo de sueldo" : "Cargar recibo de sueldo"}</h3>
                <form onSubmit={handleSubmit(onFormSubmit)}>
                
               {/*  <div className="mb-3">
                    <label className="form-label">CUIL</label>
                    <input type="text" 
                        className="form-control"
                        placeholder="Ingrese CUIL" 
                        { ...register("title") 
                        } />
                    <small className="text-danger">{ errors.title?.message }</small>
                </div> */}
               {/*  <div className="mb-3">
                    <label className="form-label">Nombre y Apellido</label>
                    <textarea className="form-control" { ...register("content") } ></textarea>
                    <small className="text-danger">{ errors.content?.message }</small>
                </div> */}

                <div className="mb-3">
                    <label className="form-label">CUIL</label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Ingrese CUIL"
                        {...register("title")}
                        onBlur={async (e) => {
                        const cuil = e.target.value;                       
                        if (cuil.length === 11) {
                            // Buscar en la tabla de empleados
                            const { data, error } = await supabase
                            .from("products")
                            .select("content")
                            .eq("title", cuil)
                            .limit(1)
                            .single();

                            if (error) {  
                                toast.error("CUIL no encontrado");
                                setValue("content", ""); // limpio si no existe
                            } else {
                                // Concatenar nombre y apellido
                                const nombreCompleto = `${data.content}`;
                                setValue("content", nombreCompleto);
                            }
                        }
                        }}
                    />
                    <small className="text-danger">{errors.title?.message}</small>
                    </div>

                    <div className="mb-3">
                    <label className="form-label">Nombre y Apellido</label>
                    <input
                        type="text"
                        className="form-control"
                        {...register("content")}
                        readOnly
                    />
                    <small className="text-danger">{errors.content?.message}</small>
                    </div>
 



                <div className="mb-3">
                <label className="form-label">Periodo</label>
                <input
                    type="month"
                    className="form-control"
                    {...register("cost")}
                />
                <small className="text-danger">{ errors.cost?.message }</small>
                </div>
                <div className="mb-3">
                    <label className="form-label">Recibo de sueldo (PDF)</label>

                        <input
                            type="file"
                            className="form-control"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    setValue("banner_image", file, { shouldValidate: true }); // <-- importante
                                }
                            }}
                        />
                    <small className="text-danger">{ errors.banner_image?.message }</small>
                </div>
                <button type="submit" className="btn btn-success w-100 mb-5">
                    { editId  ? "Actualizar carga" : "Cargar"}
                </button>
                </form>
            </div>
        
             
            <div className="col-md-8 mt-1 table-responsive">
                <h3>Recibos de sueldos enviados</h3>
                <table className="table table-bordered">
                <thead>
                    <tr>
                    <th style={{ width: "15%" }}>Periodo</th>
                    <th>Empleador</th>   
                    <th>CUIL</th>  
                    <th style={{ width: "35%" }}>Empleado</th>  
                    <th>¿Firmado?</th>
                    <th>Recibo</th>
                    <th style={{ width: "25%" }}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {
                        products ?  products.map( (singleProduct, index) => ( 
                            <tr key={ index }>
                                    <td>{ singleProduct.cost }</td>
                                    <td>{"Empleador"}</td>
                                    <td>{ singleProduct.title }</td>
                                    <td>{ singleProduct.content }</td> 
                                    <td>{"No"}</td>                                                                       
                                    <td className="text-center">
                                       {/* {
                                            singleProduct.banner_image ? (
                                                <Image src="/logo_pdf.png"  / * {singleProduct.banner_image} * / 
                                                alt="Sample Product" 
                                                width="50" 
                                                height={ 50 } />
                                            ) : ("--")
                                       }  */}

                                       
                                            {singleProduct.banner_image ? (
                                                <a href={singleProduct.banner_image} target="_blank" rel="noopener noreferrer">
                                                <img src="/logo_pdf.png" alt="Ver PDF" className="img-fluid" style={{ maxWidth: "30px" }} />
                                                </a>
                                            ) : ("--")}
                                            
                                        
                                    </td>
                                    <td>
                                        <button className="btn btn-primary btn-sm me-2 mb-1 mb-md-0 mb-sm-0" onClick={ () => handleEditData(singleProduct) }>Editar</button>
                                        <button className="btn btn-danger btn-sm" style={ {
                                            marginLeft: "0px"
                                        } } onClick={ () => handleDeleteProduct(singleProduct.id!) }>Borrar</button>
                                </td>
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