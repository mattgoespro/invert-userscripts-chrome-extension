// import { ReactElement, useMemo, useState } from 'react';
// import { TabViewContentProps } from './tab-view-content';
// import { uuid } from '@/lib/utils';
// import { Box } from 'lucide-react';

// type TabViewProps = {
//   numTabs: number;
//   onTabChange?: (tabIndex: number, label?: string) => void;
//   children: ReactElement<TabViewContentProps>[];
// };

// export default function TabView({ numTabs, children, onTabChange }: TabViewProps) {
//   const [currentIndex, setCurrentIndex] = useState(0);

//   const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
//     setCurrentIndex(newValue);
//     onTabChange(newValue, children[newValue].props.label);
//   };

//   const tabContent = useMemo(() => {
//     return children[currentIndex]?.props.children;
//   }, [children, currentIndex]);

//   return (
//     <Box sx={{ width: '100%', ...sx }}>
//       <Tabs
//         variant="fullWidth"
//         value={currentIndex}
//         onChange={handleChange}
//         sx={{
//           marginBottom: 1,
//           borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
//           '& .Mui-selected': { backgroundColor: 'rgba(255, 255, 255, 0.04)' },
//         }}
//       >
//         {Array.from({ length: numTabs }).map((_, index) => (
//           <Tab
//             disableTouchRipple
//             key={uuid()}
//             wrapped
//             label={
//               <Typography variant="button" fontWeight="bold" color="primary">
//                 {children[index].props.label}
//               </Typography>
//             }
//           />
//         ))}
//       </Tabs>
//       {tabContent}
//     </Box>
//   );
// }
