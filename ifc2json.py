import ifcopenshell
import ifcopenshell.util.element
import json
import sys
import os

def get_material_info(element):
    """Extract material information from an element"""
    material_info = []
    
    # Try to get material relationships
    if hasattr(element, "HasAssociations"):
        for association in element.HasAssociations:
            if association.is_a("IfcRelAssociatesMaterial"):
                material = association.RelatingMaterial
                
                # Handle different material association types
                if material.is_a('IfcMaterial'):
                    material_info.append({
                        "type": "IfcMaterial",
                        "name": material.Name,
                        "category": getattr(material, "Category", None),
                    })
                
                elif material.is_a('IfcMaterialList'):
                    for mat in material.Materials:
                        material_info.append({
                            "type": "IfcMaterial",
                            "name": mat.Name,
                            "category": getattr(mat, "Category", None),
                        })
                
                elif material.is_a('IfcMaterialLayerSetUsage'):
                    layer_set = material.ForLayerSet
                    for layer in layer_set.MaterialLayers:
                        if layer.Material:
                            material_info.append({
                                "type": "IfcMaterialLayer",
                                "name": layer.Material.Name,
                                "category": getattr(layer.Material, "Category", None),
                                "thickness": layer.LayerThickness,
                            })
    
    return material_info

def get_quantities(element, ifc_file):
    """Extract quantities from an element"""
    quantities = {}
    
    # Get all quantity relationships
    for rel in ifc_file.get_inverse(element):
        if rel.is_a("IfcRelDefinesByProperties"):
            property_set = rel.RelatingPropertyDefinition
            
            # Check if it's a quantity set
            if property_set.is_a("IfcElementQuantity"):
                quantities[property_set.Name] = {}
                
                # Extract all quantities from the set
                for quantity in property_set.Quantities:
                    if quantity.is_a("IfcQuantityLength"):
                        quantities[property_set.Name][quantity.Name] = {
                            "type": "length",
                            "value": quantity.LengthValue,
                            "unit": "m"
                        }
                    elif quantity.is_a("IfcQuantityArea"):
                        quantities[property_set.Name][quantity.Name] = {
                            "type": "area",
                            "value": quantity.AreaValue,
                            "unit": "m²"
                        }
                    elif quantity.is_a("IfcQuantityVolume"):
                        quantities[property_set.Name][quantity.Name] = {
                            "type": "volume",
                            "value": quantity.VolumeValue,
                            "unit": "m³"
                        }
                    elif quantity.is_a("IfcQuantityCount"):
                        quantities[property_set.Name][quantity.Name] = {
                            "type": "count",
                            "value": quantity.CountValue,
                        }
                    elif quantity.is_a("IfcQuantityWeight"):
                        quantities[property_set.Name][quantity.Name] = {
                            "type": "weight",
                            "value": quantity.WeightValue,
                            "unit": "kg"
                        }
    
    return quantities

def element_to_dict(element, ifc_file):
    """Convert an IFC element to a dictionary with all its information"""
    # Get basic information
    result = {
        "id": element.id(),
        "global_id": getattr(element, "GlobalId", None),
        "name": getattr(element, "Name", None),
        "description": getattr(element, "Description", None),
        "type": element.is_a(),
        "object_type": getattr(element, "ObjectType", None),
    }
    
    # Get properties using ifcopenshell.util.element
    try:
        props = ifcopenshell.util.element.get_psets(element)
        result["properties"] = props
    except:
        result["properties"] = {}
    
    # Get quantities
    result["quantities"] = get_quantities(element, ifc_file)
    
    # Get material information
    result["materials"] = get_material_info(element)
    
    # Get location/placement information if available
    if hasattr(element, "ObjectPlacement"):
        placement = element.ObjectPlacement
        if placement and placement.is_a("IfcLocalPlacement") and placement.RelativePlacement:
            loc = placement.RelativePlacement
            if hasattr(loc, "Location") and loc.Location:
                coords = loc.Location.Coordinates
                result["location"] = {
                    "x": coords[0],
                    "y": coords[1],
                    "z": coords[2] if len(coords) > 2 else 0
                }
    
    # Clean None values for JSON serialization
    for key, value in list(result.items()):
        if value is None:
            del result[key]
    
    return result

def main(ifc_file_path, output_file=None):
    """Process an IFC file and extract information about all elements"""
    if not os.path.exists(ifc_file_path):
        print(f"Error: File {ifc_file_path} not found.")
        return
    
    # Load the IFC file
    print(f"Loading IFC file: {ifc_file_path}")
    ifc_file = ifcopenshell.open(ifc_file_path)
    
    # Get all elements
    all_elements = ifc_file.by_type("IfcElement")
    print(f"Found {len(all_elements)} elements")
    
    # Process each element
    elements_data = {}
    for i, element in enumerate(all_elements):
        if i % 100 == 0 and i > 0:
            print(f"Processed {i}/{len(all_elements)} elements...")
            
        try:
            element_data = element_to_dict(element, ifc_file)
            elements_data[element.GlobalId] = element_data
        except Exception as e:
            print(f"Error processing element {getattr(element, 'GlobalId', element.id())}: {str(e)}")
    
    # Output results
    if output_file:
        with open(output_file, 'w') as f:
            json.dump(elements_data, f, indent=2)
        print(f"Results saved to {output_file}")
    else:
        print(json.dumps(elements_data, indent=2))
    
    print("Processing complete")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ifc_to_json.py <ifc_file_path> [output_json_file]")
    elif len(sys.argv) == 2:
        main(sys.argv[1])
    else:
        main(sys.argv[1], sys.argv[2])