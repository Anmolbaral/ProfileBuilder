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
      <div className="document-visualization__card">
        <Tabs defaultValue="details" className="document-visualization__tabs">
          <TabsList className="document-visualization__tabs-list">
            <TabsTrigger value="details" className="document-visualization__tabs-trigger">Document Details</TabsTrigger>
            <TabsTrigger value="raw" className="document-visualization__tabs-trigger">Raw Text</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="document-visualization__tabs-content">
            <Card>
              <CardHeader>
                <CardTitle>Document Information</CardTitle>
              </CardHeader>
              <CardContent>
                <Table className="document-visualization__table">
                  <TableHeader className="document-visualization__table-header">
                    <TableRow>
                      <TableHead className="document-visualization__table-cell document-visualization__table-cell--header">Property</TableHead>
                      <TableHead className="document-visualization__table-cell document-visualization__table-cell--header">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="document-visualization__table-cell">Title</TableCell>
                      <TableCell className="document-visualization__table-cell">{doc.metadata.title || "N/A"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="document-visualization__table-cell">Author</TableCell>
                      <TableCell className="document-visualization__table-cell">{doc.metadata.author || "N/A"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="document-visualization__table-cell">Creation Date</TableCell>
                      <TableCell className="document-visualization__table-cell">
                        {doc.createdAt
                          ? format(new Date(doc.createdAt), "PPP")
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="document-visualization__table-cell">Pages</TableCell>
                      <TableCell className="document-visualization__table-cell">{doc.metadata.pageCount?.toString() || "N/A"}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw" className="document-visualization__tabs-content">
            <Card>
              <CardHeader>
                <CardTitle>Raw Text Content</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="document-visualization__accordion">
                  {doc.rawText.split("\f").map((paragraph: string, index: number) => (
                    <AccordionItem key={index} value={`item-${index}`} className="document-visualization__accordion-item">
                      <AccordionTrigger className="document-visualization__accordion-trigger">
                        Paragraph {index + 1}
                      </AccordionTrigger>
                      <AccordionContent className="document-visualization__accordion-content">
                        <p className="document-visualization__paragraph">{paragraph.trim()}</p>
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