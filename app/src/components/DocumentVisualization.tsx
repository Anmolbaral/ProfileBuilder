import { format } from 'date-fns'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

interface DocumentVisualizationProps {
  doc: {
    id: string
    filename: string
    rawText: string
    metadata: {
      title?: string
      author?: string
      pageCount?: number
    }
    createdAt: string
  }
}

export function DocumentVisualization({ doc }: DocumentVisualizationProps) {
  return (
    <div className="document-visualization">
      <div className="document-visualization-card">
        <Tabs defaultValue="details" className="document-visualization-tabs">
          <TabsList className="document-visualization-tabs-list">
            <TabsTrigger value="details" className="document-visualization-tabs-trigger">Document Details</TabsTrigger>
            <TabsTrigger value="raw" className="document-visualization-tabs-trigger">Raw Text</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="document-visualization-tabs-content">
            <Card>
              <CardHeader>
                <CardTitle>Document Information</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Title</TableCell>
                      <TableCell>{doc.metadata.title || "N/A"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Author</TableCell>
                      <TableCell>{doc.metadata.author || "N/A"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Creation Date</TableCell>
                      <TableCell>
                        {doc.createdAt
                          ? format(new Date(doc.createdAt), "PPP")
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Pages</TableCell>
                      <TableCell>{doc.metadata.pageCount?.toString() || "N/A"}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw" className="document-visualization-tabs-content">
            <Card>
              <CardHeader>
                <CardTitle>Raw Text Content</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {doc.rawText.split("\f").map((paragraph: string, index: number) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger>
                        Paragraph {index + 1}
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="whitespace-pre-wrap">{paragraph.trim()}</p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 