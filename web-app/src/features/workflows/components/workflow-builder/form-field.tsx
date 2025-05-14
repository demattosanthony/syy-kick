// import { Label } from "@/components/ui/label";
// import { Button } from "@/components/ui/button";
// import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
// import { FormFieldProps } from "../../workflows.types";
// import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
// import { Switch } from "@/components/ui/switch";
// import { FileText, Type, Hash, Calendar, List, TextCursor, Plus, X, Trash2 } from "lucide-react";
// import { Badge } from "@/components/ui/badge";

// const FormField = ({ fieldKey, field, stepIndex, onFieldChange, onDeleteField, fieldError }: FormFieldProps) => {

//     const getFieldIcon = (type: string) => {
//         switch (type) {
//             case 'file':
//                 return <FileText className="h-4 w-4" />;
//             case 'text':
//                 return <Type className="h-4 w-4" />;
//             case 'number':
//                 return <Hash className="h-4 w-4" />;
//             case 'date':
//                 return <Calendar className="h-4 w-4" />;
//             case 'select':
//                 return <List className="h-4 w-4" />;
//             default:
//                 return <TextCursor className="h-4 w-4" />;
//         }
//     };

//     const handleAddOption = () => {
//         const newOption = {
//             label: `Option ${(field.options || []).length + 1}`,
//             value: `Value ${(field.options || []).length + 1}`
//         };
//         onFieldChange(fieldKey, {
//             ...field,
//             options: [...(field.options || []), newOption]
//         });
//     };

//     const handleUpdateOption = (index: number, key: 'label' | 'value', value: string) => {
//         const updatedOptions = [...(field.options || [])];
//         updatedOptions[index] = {
//             ...updatedOptions[index],
//             [key]: value
//         };
//         onFieldChange(fieldKey, {
//             ...field,
//             options: updatedOptions
//         });
//     };

//     const handleRemoveOption = (index: number) => {
//         const updatedOptions = [...(field.options || [])];
//         updatedOptions.splice(index, 1);
//         onFieldChange(fieldKey, {
//             ...field,
//             options: updatedOptions
//         });
//     };

//     return (
//         <div key={fieldKey} className={`mb-4 p-4 border rounded-lg bg-card shadow-sm relative ${fieldError ? 'border-destructive' : ''}`}>
//             {onDeleteField && (
//                 <Button
//                     variant="outline"
//                     size="icon"
//                     onClick={() => onDeleteField(fieldKey)}
//                     className="absolute -top-4 -right-4 h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
//                 >
//                     <Trash2 className="h-4 w-4" />
//                 </Button>
//             )}
//             <div className="flex items-center justify-between mb-4">
//                 <div className="flex items-center gap-2">
//                     <div className="p-2 bg-secondary rounded-md">
//                         {getFieldIcon(field.type)}
//                     </div>
//                     <div className="space-y-1">
//                         <Input
//                             value={field.label}
//                             onChange={(e) => onFieldChange(fieldKey, { ...field, label: e.target.value })}
//                             placeholder="Field label"
//                             className="text-lg font-semibold h-8"
//                         />
//                         <span className="text-xs text-muted-foreground">
//                             {field.type} field
//                         </span>
//                     </div>
//                 </div>
//                 <div className="flex items-center space-x-2">
//                     <Switch
//                         id={`required-${fieldKey}`}
//                         checked={field.required}
//                         onCheckedChange={(checked) => onFieldChange(fieldKey, { ...field, required: checked })}
//                     />
//                     <Label htmlFor={`required-${fieldKey}`}>Required</Label>
//                 </div>
//             </div>

//             <div className="space-y-4">
//                 <div className="space-y-2">
//                     <Label>Description</Label>
//                     <Textarea
//                         value={field.description || ''}
//                         onChange={(e) => onFieldChange(fieldKey, { ...field, description: e.target.value })}
//                         placeholder="Add a description..."
//                         className="h-20"
//                     />
//                 </div>

//                 <div className="space-y-2">
//                     <Label>Source</Label>
//                     <RadioGroup
//                         value={field.referenceType || (stepIndex > 0 ? 'previousStep' : 'userInput')}
//                         onValueChange={(value: 'userInput' | 'previousStep') => {
//                             onFieldChange(fieldKey, { ...field, referenceType: value });
//                         }}
//                     >
//                         <div className="flex items-center space-x-2">
//                             <RadioGroupItem
//                                 value="userInput"
//                                 id={`${fieldKey}-userInput`}
//                                 disabled={stepIndex > 0}
//                             />
//                             <Label htmlFor={`${fieldKey}-userInput`} className={stepIndex > 0 ? "text-muted-foreground" : ""}>
//                                 User Input
//                                 {stepIndex > 0 && (
//                                     <Badge
//                                         variant="default"
//                                         className="ml-2 text-xs"
//                                     >
//                                         Coming soon
//                                     </Badge>
//                                 )}
//                             </Label>
//                         </div>
//                         {stepIndex > 0 && (
//                             <div className="flex items-center space-x-2">
//                                 <RadioGroupItem value="previousStep" id={`${fieldKey}-previousStep`} />
//                                 <Label htmlFor={`${fieldKey}-previousStep`}>Previous Step Output</Label>
//                             </div>
//                         )}
//                     </RadioGroup>
//                 </div>

//                 {field.type === 'select' && (
//                     <div className="space-y-2">
//                         <div className="flex items-center justify-between">
//                             <Label>Options</Label>
//                             <Button
//                                 variant="outline"
//                                 size="sm"
//                                 onClick={handleAddOption}
//                                 className="h-8"
//                             >
//                                 <Plus className="h-4 w-4 mr-2" />
//                                 Add Option
//                             </Button>
//                         </div>
//                         <div className="space-y-2">
//                             {field.options?.map((option, index) => (
//                                 <div key={option.value} className="flex items-center gap-2">
//                                     <Input
//                                         value={option.label}
//                                         onChange={(e) => handleUpdateOption(index, 'label', e.target.value)}
//                                         placeholder="Option label"
//                                         className="flex-1"
//                                     />
//                                     <Input
//                                         value={option.value}
//                                         onChange={(e) => handleUpdateOption(index, 'value', e.target.value)}
//                                         placeholder="Option value"
//                                         className="flex-1"
//                                     />
//                                     <Button
//                                         variant="ghost"
//                                         size="icon"
//                                         onClick={() => handleRemoveOption(index)}
//                                         className="h-8 w-8"
//                                     >
//                                         <X className="h-4 w-4" />
//                                     </Button>
//                                 </div>
//                             ))}
//                             {field.options?.length === 0 && (
//                                 <div className="text-muted-foreground text-sm">
//                                     No options added yet
//                                 </div>
//                             )}
//                         </div>
//                     </div>
//                 )}
//             </div>
//             {fieldError && (
//                 <div className="text-destructive text-sm mt-2">
//                     {fieldError.message}
//                 </div>
//             )}
//         </div>
//     );
// };

// export default FormField;