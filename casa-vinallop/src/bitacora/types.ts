export const CATEGORIAS = {
  distribucion: 'Distribución',
  estructura: 'Estructura y alturas',
  cubierta: 'Cubierta',
  fachadas: 'Fachadas y carpinterías',
  exterior: 'Exterior',
  instalaciones: 'Instalaciones',
  presupuesto: 'Presupuesto',
  planos: 'Planos',
  obra: 'Obra',
  otros: 'Otros',
} as const;
export type Categoria = keyof typeof CATEGORIAS;

/** Foto de una entrada: el archivo se guarda solo en este dispositivo (IndexedDB). */
export interface CambioFoto { id: string; nombre: string; mime: string; ancho: number; alto: number; pie: string }

export interface CambioEntrada {
  id: string;
  /** AAAA-MM-DD */
  fecha: string;
  categoria: Categoria;
  titulo: string;
  descripcion: string;
  /** notas de la propiedad */
  notas: string;
  fotos: CambioFoto[];
  /** «estudio» = cambio hecho en el modelo; «propiedad» = entrada añadida a mano */
  origen: 'estudio' | 'propiedad';
}
